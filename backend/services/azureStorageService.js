import { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } from '@azure/storage-blob';
import config from '../config/config.js';

/**
 * Azure Blob Storage Service for video uploads
 * Handles uploading videos to Azure Storage containers
 */
class AzureStorageService {
  constructor() {
    this.blobServiceClient = null;
    this.containerClient = null;
    this.initialized = false;
    this.accountName = null;
    this.accountKey = null;
  }

  /**
   * Initialize the Azure Storage client
   * Called lazily on first use to avoid errors when Azure is disabled
   */
  async initialize() {
    if (this.initialized) return true;

    const { connectionString, containerName, enabled } = config.azure;

    if (!enabled) {
      console.log('Azure Storage is disabled');
      return false;
    }

    if (!connectionString) {
      console.warn('Azure Storage connection string not configured');
      return false;
    }

    try {
      // Parse connection string to get account name and key for SAS generation
      const parts = connectionString.trim().split(';');
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart.startsWith('AccountName=')) {
          this.accountName = trimmedPart.split('=')[1];
        } else if (trimmedPart.startsWith('AccountKey=')) {
          this.accountKey = trimmedPart.split('=')[1];
        }
      }

      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(containerName);

      // Create container if it doesn't exist
      // Note: We don't set access: 'blob' because public access might be disabled at the account level
      await this.containerClient.createIfNotExists();

      this.initialized = true;
      console.log(`Azure Storage initialized. Container: ${containerName}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize Azure Storage:', error.message);
      return false;
    }
  }

  /**
   * Generate a SAS URL for a blob
   * @param {string} blobName - The name of the blob
   * @param {number} expiryMinutes - How long the SAS token should be valid (default 60 min)
   * @returns {string} - The SAS URL
   */
  generateSasUrl(blobName, expiryMinutes = 60) {
    if (!this.initialized || !this.accountName || !this.accountKey) {
      return this.containerClient.getBlockBlobClient(blobName).url;
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const permissions = new BlobSASPermissions();
    permissions.read = true;

    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);

    const sasToken = generateBlobSASQueryParameters({
      containerName: config.azure.containerName,
      blobName: blobName,
      permissions: permissions,
      expiresOn: expiryTime
    }, sharedKeyCredential).toString();

    return `${this.containerClient.getBlockBlobClient(blobName).url}?${sasToken}`;
  }

  /**
   * Check if Azure Storage is available and enabled
   * @returns {boolean}
   */
  isEnabled() {
    return config.azure.enabled && !!config.azure.connectionString;
  }

  /**
   * Upload a video file to Azure Blob Storage
   * @param {Buffer} fileBuffer - The file buffer to upload
   * @param {string} filename - The name to use for the blob
   * @param {string} contentType - The MIME type of the file
   * @returns {Promise<{url: string, blobName: string}>} - The blob URL and name
   * @throws {Error} - If upload fails
   */
  async uploadVideo(fileBuffer, filename, contentType = 'video/mp4') {
    const isInitialized = await this.initialize();
    
    if (!isInitialized) {
      throw new Error('Azure Storage is not available');
    }

    try {
      // Generate unique blob name
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const blobName = `${uniqueSuffix}-${filename}`;

      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      // Upload the buffer
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: contentType
        }
      };

      await blockBlobClient.uploadData(fileBuffer, uploadOptions);

      // Generate a SAS URL since public access might be disabled
      const blobUrl = this.generateSasUrl(blobName);

      console.log(`Video uploaded to Azure: ${blobName}`);
      
      return {
        url: blobUrl,
        blobName: blobName
      };
    } catch (error) {
      console.error('Azure upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Get the URL for an existing blob
   * @param {string} blobName - The name of the blob
   * @returns {string} - The full URL to the blob (with SAS token)
   */
  getBlobUrl(blobName) {
    if (!this.containerClient) {
      throw new Error('Azure Storage not initialized');
    }
    return this.generateSasUrl(blobName);
  }

  /**
   * Delete a blob from storage
   * @param {string} blobName - The name of the blob to delete
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteBlob(blobName) {
    const isInitialized = await this.initialize();
    
    if (!isInitialized) {
      throw new Error('Azure Storage is not available');
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();
      console.log(`Blob deleted: ${blobName}`);
      return true;
    } catch (error) {
      console.error('Failed to delete blob:', error.message);
      throw error;
    }
  }

  /**
   * Check if a blob exists
   * @param {string} blobName - The name of the blob
   * @returns {Promise<boolean>}
   */
  async blobExists(blobName) {
    const isInitialized = await this.initialize();
    
    if (!isInitialized) {
      return false;
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch (error) {
      console.error('Failed to check blob existence:', error.message);
      return false;
    }
  }
}

// Export singleton instance
const azureStorageService = new AzureStorageService();
export default azureStorageService;
