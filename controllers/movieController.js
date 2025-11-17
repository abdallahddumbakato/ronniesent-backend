import pool from '../config/database.js';
import { WasabiService } from '../services/wasabiService.js';

// === EXISTING ESSENTIAL FUNCTIONS ===

// Get all movies for user based on subscription
export const getMovies = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Get user's subscription info
    const userResult = await pool.query(`
      SELECT subscription_plan_id, subscription_expiry 
      FROM userz 
      WHERE id = $1
    `, [userId]);

    const user = userResult.rows[0];
    const hasActiveSubscription = user?.subscription_expiry && new Date(user.subscription_expiry) > new Date();

    let moviesQuery = `
      SELECT 
        m.*,
        u.full_name as uploaded_by_name,
        EXISTS(
          SELECT 1 FROM downloadz d 
          WHERE d.user_id = $1 AND d.movie_id = m.id
        ) as is_downloaded
      FROM moviez m
      LEFT JOIN userz u ON m.uploaded_by = u.id
      WHERE m.is_active = true
    `;

    const queryParams = [userId];

    // For clients, filter by subscription plan
    if (userRole === 'client' && hasActiveSubscription) {
      moviesQuery += ` AND $2 = ANY(m.subscription_plan_ids)`; // REMOVED the OR condition
      queryParams.push(user.subscription_plan_id);
    } else if (userRole === 'client') {
      // Clients without subscription see no movies
      moviesQuery += ` AND false`;
    }
    // Agents and admins see all movies

    moviesQuery += ` ORDER BY m.uploaded_at DESC`;

    const moviesResult = await pool.query(moviesQuery, queryParams);
    
    // Get user's downloaded movies count for Luganda check
    const downloadsResult = await pool.query(`
      SELECT COUNT(*) as downloaded_local_count
      FROM downloadz d
      JOIN moviez m ON d.movie_id = m.id
      WHERE d.user_id = $1 AND m.category = 'local'
    `, [userId]);

    const totalLocalResult = await pool.query(`
      SELECT COUNT(*) as total_local_count
      FROM moviez 
      WHERE category = 'local' AND is_active = true
    `);

    const downloadedLocalCount = parseInt(downloadsResult.rows[0].downloaded_local_count);
    const totalLocalCount = parseInt(totalLocalResult.rows[0].total_local_count);
    const canAccessEnglish = totalLocalCount === 0 || downloadedLocalCount >= totalLocalCount;

    res.json({
      movies: moviesResult.rows,
      canAccessEnglish,
      downloadedLocalCount,
      totalLocalCount,
      hasActiveSubscription
    });

  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({ error: 'Failed to load movies' });
  }
};

// Download movie
export const downloadMovie = async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Get movie details
    const movieResult = await pool.query(`
      SELECT m.*
      FROM moviez m
      WHERE m.id = $1 AND m.is_active = true
    `, [movieId]);

    if (movieResult.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const movie = movieResult.rows[0];

    // TRUTH: Only check database for download status
    const downloadCheck = await pool.query(`
      SELECT 1 FROM downloadz WHERE user_id = $1 AND movie_id = $2
    `, [userId, movieId]);

    if (downloadCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You have already downloaded this movie' });
    }

    // Check subscription for clients
    if (userRole === 'client') {
      const userResult = await pool.query(`
        SELECT subscription_plan_id, subscription_expiry 
        FROM userz WHERE id = $1
      `, [userId]);

      const user = userResult.rows[0];
      const hasActiveSubscription = user?.subscription_expiry && new Date(user.subscription_expiry) > new Date();
      
      if (!hasActiveSubscription) {
        return res.status(403).json({ error: 'Please subscribe to download movies' });
      }

      // STRICT: Movie must be in user's plan
      if (!movie.subscription_plan_ids.includes(user.subscription_plan_id)) {
        return res.status(403).json({ error: 'This movie is not available for your subscription plan' });
      }
    }

    // Check Luganda-first rule
    if (movie.category === 'english') {
      const downloadsResult = await pool.query(`
        SELECT COUNT(*) as downloaded_local_count
        FROM downloadz d
        JOIN moviez m ON d.movie_id = m.id
        WHERE d.user_id = $1 AND m.category = 'local'
      `, [userId]);

      const totalLocalResult = await pool.query(`
        SELECT COUNT(*) as total_local_count
        FROM moviez 
        WHERE category = 'local' AND is_active = true
      `);

      const downloadedLocalCount = parseInt(downloadsResult.rows[0].downloaded_local_count);
      const totalLocalCount = parseInt(totalLocalResult.rows[0].total_local_count);

      // ✅ APPLIES TO EVERYONE: agents, clients, admins
      if (downloadedLocalCount < totalLocalCount) {
        return res.status(403).json({ 
          error: `Please download all local movies first. You have downloaded ${downloadedLocalCount} of ${totalLocalCount} local movies.` 
        });
      }
    }

    // Generate download URL
    const downloadUrl = await WasabiService.getDownloadUrl(movie.file_key, `${movie.title}.mp4`);

    res.json({ 
      downloadUrl,
      message: 'Download started successfully'
    });

  } catch (error) {
    console.error('Download movie error:', error);
    res.status(500).json({ error: 'Failed to initiate download' });
  }
};

export const completeDownload = async (req, res) => {
  try {
    const { movieId } = req.params;
    const userId = req.user.userId;

    // ONLY mark as downloaded when file is 100% saved
    await pool.query(`
      INSERT INTO downloadz (user_id, movie_id) 
      VALUES ($1, $2)
      ON CONFLICT (user_id, movie_id) DO NOTHING
    `, [userId, movieId]);

    // Update download count
    await pool.query(`
      UPDATE moviez 
      SET downloads_count = downloads_count + 1 
      WHERE id = $1
    `, [movieId]);

    res.json({ 
      success: true,
      message: 'Download completed successfully'
    });

  } catch (error) {
    console.error('Complete download error:', error);
    res.status(500).json({ error: 'Failed to mark download as completed' });
  }
};

// Get trending movies (random 6, changes daily)
export const getTrendingMovies = async (req, res) => {
  try {
    // Use date-based seed for consistent daily randomness
    const today = new Date().toDateString();
    const seed = today.split('-').join('');
    
    const trendingResult = await pool.query(`
      SELECT m.*, u.full_name as uploaded_by_name
      FROM moviez m
      LEFT JOIN userz u ON m.uploaded_by = u.id
      WHERE m.is_active = true
      ORDER BY (m.downloads_count * 0.7 + random() * 0.3) DESC
      LIMIT 6
    `);

    res.json({ movies: trendingResult.rows });

  } catch (error) {
    console.error('Get trending movies error:', error);
    res.status(500).json({ error: 'Failed to load trending movies' });
  }
};

// Admin: Create movie (simple upload)
export const createMovie = async (req, res) => {
  try {
    const movieData = req.body;
    const userId = req.user.userId;

    const movieResult = await pool.query(`
      INSERT INTO moviez (
        title, category, thumbnail_url, file_key, file_size,
        subscription_plan_ids, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      movieData.title,
      movieData.category,
      movieData.thumbnailUrl,
      movieData.fileKey,
      movieData.fileSize,
      movieData.subscriptionPlanIds || [],
      userId
    ]);

    res.json({ 
      success: true, 
      movie: movieResult.rows[0],
      message: 'Movie created successfully'
    });

  } catch (error) {
    console.error('Create movie error:', error);
    res.status(500).json({ error: 'Failed to create movie' });
  }
};

// Admin: Get all movies for management
export const getAllMovies = async (req, res) => {
  try {
    const moviesResult = await pool.query(`
      SELECT m.*, u.full_name as uploaded_by_name
      FROM moviez m
      LEFT JOIN userz u ON m.uploaded_by = u.id
      ORDER BY m.uploaded_at DESC
    `);

    res.json({ movies: moviesResult.rows });

  } catch (error) {
    console.error('Get all movies error:', error);
    res.status(500).json({ error: 'Failed to load movies' });
  }
};

// === NEW ENHANCED FUNCTIONS ===

// Enhanced startUpload with resume capability
export const startUpload = async (req, res) => {
  try {
    const { fileName, fileType, fileSize } = req.body;
    const userId = req.user.userId;

    // Check for existing upload session
    const existingSession = await pool.query(`
      SELECT * FROM upload_sessions 
      WHERE file_name = $1 AND user_id = $2 AND status != 'completed'
    `, [fileName, userId]);

    let uploadId, fileKey;

    if (existingSession.rows.length > 0) {
      // Resume existing upload
      const session = existingSession.rows[0];
      uploadId = session.upload_id;
      fileKey = session.file_key;
      
      await pool.query(`
        UPDATE upload_sessions 
        SET status = 'uploading', last_activity = CURRENT_TIMESTAMP
        WHERE file_key = $1
      `, [fileKey]);

      res.json({ 
        uploadId, 
        fileKey,
        isResume: true,
        uploadedChunks: session.uploaded_chunks || []
      });
    } else {
      // Start new upload
      const result = await WasabiService.startMultipartUpload(fileName, fileType);
      uploadId = result.uploadId;
      fileKey = result.fileKey;

      // Store upload session in database
      await pool.query(`
        INSERT INTO upload_sessions (
          file_key, upload_id, file_name, file_type, file_size, 
          user_id, status, total_chunks
        ) VALUES ($1, $2, $3, $4, $5, $6, 'uploading', $7)
      `, [fileKey, uploadId, fileName, fileType, fileSize, userId, Math.ceil(fileSize / (50 * 1024 * 1024))]);

      res.json({ 
        uploadId, 
        fileKey,
        isResume: false,
        uploadedChunks: []
      });
    }

  } catch (error) {
    console.error('Start upload error:', error);
    res.status(500).json({ error: 'Failed to start upload' });
  }
};

// Enhanced getUploadUrl with chunk tracking
export const getUploadUrl = async (req, res) => {
  try {
    const { fileKey, uploadId, partNumber } = req.body;

    const uploadUrl = await WasabiService.getUploadPartUrl(fileKey, uploadId, partNumber);

    res.json({ uploadUrl, partNumber });

  } catch (error) {
    console.error('Get upload URL error:', error);
    res.status(500).json({ error: 'Failed to get upload URL' });
  }
};

// Pause upload
export const pauseUpload = async (req, res) => {
  try {
    const { fileKey } = req.body;
    const userId = req.user.userId;

    await pool.query(`
      UPDATE upload_sessions 
      SET status = 'paused', last_activity = CURRENT_TIMESTAMP
      WHERE file_key = $1 AND user_id = $2
    `, [fileKey, userId]);

    res.json({ success: true, message: 'Upload paused successfully' });

  } catch (error) {
    console.error('Pause upload error:', error);
    res.status(500).json({ error: 'Failed to pause upload' });
  }
};

// Get upload status for resume
export const getUploadStatus = async (req, res) => {
  try {
    const { fileName } = req.params;
    const userId = req.user.userId;

    const sessionResult = await pool.query(`
      SELECT * FROM upload_sessions 
      WHERE file_name = $1 AND user_id = $2 AND status != 'completed'
    `, [fileName, userId]);

    if (sessionResult.rows.length === 0) {
      return res.json({ exists: false });
    }

    const session = sessionResult.rows[0];
    res.json({
      exists: true,
      fileKey: session.file_key,
      uploadId: session.upload_id,
      uploadedChunks: session.uploaded_chunks || [],
      progress: session.uploaded_chunks ? (session.uploaded_chunks.length / session.total_chunks) * 100 : 0,
      status: session.status
    });

  } catch (error) {
    console.error('Get upload status error:', error);
    res.status(500).json({ error: 'Failed to get upload status' });
  }
};

// Enhanced completeUpload with file_type and inactive state
export const completeUpload = async (req, res) => {
  try {
    const { fileKey, uploadId, parts, movieData } = req.body;
    const userId = req.user.userId;

    // Complete multipart upload
    await WasabiService.completeMultipartUpload(fileKey, uploadId, parts);

    // Get file extension for file_type
    const fileExtension = movieData.fileName.split('.').pop()?.toLowerCase() || 'mp4';

    // Create movie record - INACTIVE by default
    const movieResult = await pool.query(`
      INSERT INTO moviez (
        title, description, category, thumbnail_url, file_key, file_size,
        file_type, subscription_plan_ids, uploaded_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
      RETURNING *
    `, [
      movieData.title,
      movieData.description,
      movieData.category,
      movieData.thumbnailUrl,
      fileKey,
      movieData.fileSize,
      fileExtension,
      movieData.subscriptionPlanIds || [],
      userId
    ]);

    // Update upload session to completed
    await pool.query(`
      UPDATE upload_sessions 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE file_key = $1
    `, [fileKey]);

    res.json({ 
      success: true, 
      movie: movieResult.rows[0],
      message: 'Movie uploaded successfully! It will be visible to clients after activation.'
    });

  } catch (error) {
    console.error('Complete upload error:', error);
    
    // Abort upload on error
    try {
      await WasabiService.abortMultipartUpload(req.body.fileKey, req.body.uploadId);
    } catch (abortError) {
      console.error('Abort upload error:', abortError);
    }
    
    res.status(500).json({ error: 'Failed to complete upload' });
  }
};

// Upload thumbnail
export const uploadThumbnail = async (req, res) => {
  try {
    const { fileName, fileData } = req.body;
    const userId = req.user.userId;

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData.split(',')[1], 'base64');
    
    // Upload to Wasabi
    const fileKey = await WasabiService.uploadFile(
      buffer, 
      `thumbnails/${Date.now()}-${fileName}`, 
      'image/jpeg'
    );

    // Generate thumbnail URL
    const thumbnailUrl = `${process.env.WASABI_S3_ENDPOINT_URL}/${process.env.WASABI_S3_BUCKET_NAME}/${fileKey}`;

    res.json({ 
      success: true, 
      thumbnailUrl,
      message: 'Thumbnail uploaded successfully'
    });

  } catch (error) {
    console.error('Thumbnail upload error:', error);
    res.status(500).json({ error: 'Failed to upload thumbnail' });
  }
};

// Toggle movie activation
export const toggleMovieActivation = async (req, res) => {
  try {
    const { movieId } = req.params;
    const { isActive } = req.body;

    const movieResult = await pool.query(`
      UPDATE moviez 
      SET is_active = $1 
      WHERE id = $2 
      RETURNING *
    `, [isActive, movieId]);

    if (movieResult.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json({ 
      success: true, 
      movie: movieResult.rows[0],
      message: `Movie ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('Toggle movie activation error:', error);
    res.status(500).json({ error: 'Failed to update movie status' });
  }
};


// Delete movie
export const deleteMovie = async (req, res) => {
  try {
    const { movieId } = req.params;

    // Get movie details first to delete from storage
    const movieResult = await pool.query('SELECT file_key FROM moviez WHERE id = $1', [movieId]);
    
    if (movieResult.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const movie = movieResult.rows[0];

    // Delete from storage (Wasabi)
    try {
      await WasabiService.deleteFile(movie.file_key);
    } catch (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    await pool.query('DELETE FROM moviez WHERE id = $1', [movieId]);

    res.json({ 
      success: true,
      message: 'Movie deleted successfully'
    });

  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({ error: 'Failed to delete movie' });
  }
};