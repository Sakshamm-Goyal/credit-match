import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Upload a CSV file using pre-signed URL
 * @param {File} file - The CSV file to upload
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{job_id: string}>}
 */
export async function uploadFile(file, onProgress) {
  // Step 1: Get pre-signed URL from our API
  const initiateResponse = await api.post('/upload/initiate', {
    filename: file.name,
    file_size: file.size
  })

  const { job_id, upload_url } = initiateResponse.data

  // Step 2: Upload file directly to S3 using pre-signed URL
  await axios.put(upload_url, file, {
    headers: {
      'Content-Type': 'text/csv'
    },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      onProgress?.(progress)
    }
  })

  return { job_id }
}

/**
 * Get job status
 * @param {string} jobId - The job ID to check
 * @returns {Promise<Object>} - Job status and details
 */
export async function getJobStatus(jobId) {
  const response = await api.get(`/jobs/${jobId}/status`)
  return response.data
}

/**
 * Health check
 * @returns {Promise<{status: string}>}
 */
export async function healthCheck() {
  const response = await api.get('/health')
  return response.data
}

export default api
