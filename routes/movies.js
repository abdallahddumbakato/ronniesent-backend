import express from 'express';
import { 
  getMovies, 
  startUpload, 
  getUploadUrl, 
  completeUpload, 
  downloadMovie, 
  getTrendingMovies,
  createMovie,
  getAllMovies,
  pauseUpload,
  getUploadStatus,
  uploadThumbnail,
  toggleMovieActivation,
  completeDownload,
  deleteMovie
} from '../controllers/movieController.js';
import { authenticateToken } from '../middleware/auth.js';


const router = express.Router();

// PUBLIC route (no authentication required)
router.get('/public/trending', getTrendingMovies);

// All routes require authentication
router.use(authenticateToken);

// Client/Agent routes
router.get('/', getMovies);
router.get('/trending', getTrendingMovies);
router.get('/download/:movieId', downloadMovie);
router.post('/download/:movieId/complete', completeDownload);

// Admin upload routes (chunked upload)
router.post('/upload/start', startUpload);
router.post('/upload/url', getUploadUrl);
router.post('/upload/complete', completeUpload);
router.post('/upload/pause', pauseUpload);
router.get('/upload/status/:fileName', getUploadStatus);


// Thumbnail upload
router.post('/upload/thumbnail', uploadThumbnail);

// Movie activation
router.patch('/admin/activate/:movieId', toggleMovieActivation);

// Admin movie management
router.get('/admin/all', getAllMovies);
router.post('/admin/create', createMovie);
router.delete('/admin/:movieId', deleteMovie);

export default router;