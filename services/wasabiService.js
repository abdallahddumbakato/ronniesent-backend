import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: process.env.WASABI_REGION,
  endpoint: process.env.WASABI_S3_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
    secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export class WasabiService {
  // Generate upload ID for chunked uploads
  static async startMultipartUpload(fileName, fileType) {
    const fileKey = `movies/${uuidv4()}-${fileName}`;
    
    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      ContentType: fileType,
    });

    const result = await s3Client.send(command);
    return {
      uploadId: result.UploadId,
      fileKey: result.Key,
    };
  }

  // Generate presigned URL for each chunk
  static async getUploadPartUrl(fileKey, uploadId, partNumber) {
    const command = new UploadPartCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  }

  // Complete multipart upload
  static async completeMultipartUpload(fileKey, uploadId, parts) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    const result = await s3Client.send(command);
    return result.Location;
  }

  // Abort multipart upload
  static async abortMultipartUpload(fileKey, uploadId) {
    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      UploadId: uploadId,
    });

    await s3Client.send(command);
  }

  // Generate download URL (presigned)
  static async getDownloadUrl(fileKey, fileName) {
    const command = new GetObjectCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      ResponseContentDisposition: `attachment; filename="${fileName}"`,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
    return url;
  }

  // Simple file upload (for small files)
  static async uploadFile(fileBuffer, fileName, fileType) {
    const fileKey = `movies/${uuidv4()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.WASABI_S3_BUCKET_NAME,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await s3Client.send(command);
    return fileKey;
  }

  // Delete file
  static async deleteFile(fileKey) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.WASABI_S3_BUCKET_NAME,
        Key: fileKey
      });
      
      await s3Client.send(command);
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }
}