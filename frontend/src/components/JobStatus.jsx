import { useState, useEffect } from 'react'
import { getJobStatus } from '../services/api'

const STATUS_COLORS = {
  UPLOADED: 'bg-blue-100 text-blue-800',
  VALIDATING: 'bg-yellow-100 text-yellow-800',
  STAGING: 'bg-yellow-100 text-yellow-800',
  PARSING: 'bg-yellow-100 text-yellow-800',
  LOADED: 'bg-indigo-100 text-indigo-800',
  MATCHING_TRIGGERED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800'
}

const STATUS_LABELS = {
  UPLOADED: 'File Uploaded',
  VALIDATING: 'Validating Data',
  STAGING: 'Staging Data',
  PARSING: 'Parsing CSV',
  LOADED: 'Data Loaded',
  MATCHING_TRIGGERED: 'Matching Users',
  COMPLETED: 'Completed',
  FAILED: 'Failed'
}

function JobStatus({ jobId, onReset }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let interval
    let isMounted = true

    const fetchStatus = async () => {
      try {
        const data = await getJobStatus(jobId)
        if (isMounted) {
          setJob(data)
          setLoading(false)

          // Stop polling if completed or failed
          if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            clearInterval(interval)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    fetchStatus()
    interval = setInterval(fetchStatus, 2000) // Poll every 2 seconds

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [jobId])

  const getProgressPercentage = () => {
    const stages = ['UPLOADED', 'VALIDATING', 'STAGING', 'LOADED', 'MATCHING_TRIGGERED', 'COMPLETED']
    const currentIndex = stages.indexOf(job?.status)
    if (currentIndex === -1) return 0
    return Math.round((currentIndex / (stages.length - 1)) * 100)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-gray-600">Loading job status...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Status</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={onReset} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Processing Status</h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[job?.status] || 'bg-gray-100 text-gray-800'}`}>
            {STATUS_LABELS[job?.status] || job?.status}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-medium text-primary-600">{getProgressPercentage()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                job?.status === 'FAILED' ? 'bg-red-500' : 'bg-primary-600'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Total Rows</p>
            <p className="text-2xl font-bold text-gray-900">{job?.total_rows?.toLocaleString() || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Valid Rows</p>
            <p className="text-2xl font-bold text-green-600">{job?.valid_rows?.toLocaleString() || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Invalid Rows</p>
            <p className="text-2xl font-bold text-red-600">{job?.invalid_rows?.toLocaleString() || '0'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Processed</p>
            <p className="text-2xl font-bold text-primary-600">{job?.processed_rows?.toLocaleString() || '-'}</p>
          </div>
        </div>

        {/* Job ID */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Job ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{jobId}</code>
          </p>
        </div>
      </div>

      {/* Match Statistics (if completed) */}
      {job?.match_stats && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Match Results</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{job.match_stats.total_matches?.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Matches</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{job.match_stats.users_matched?.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Users Matched</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-3xl font-bold text-purple-600">{job.match_stats.avg_score?.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Avg Match Score</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Details (if failed) */}
      {job?.status === 'FAILED' && job?.error_message && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Processing Failed</h3>
              <p className="text-red-700 mt-1">{job.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {job?.status === 'COMPLETED' && (
        <div className="card border-green-200 bg-green-50">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-2 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-800">Processing Complete!</h3>
              <p className="text-green-700">Users have been matched with eligible loan products and notifications are being sent.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobStatus
