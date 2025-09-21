import { useState, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Custom hook for handling async operations with loading and error states
 */
export function useAsyncOperation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(async (asyncFn, options = {}) => {
    const {
      onSuccess,
      onError,
      showSuccessToast = false,
      showErrorToast = true,
      successMessage = 'Operation completed successfully',
      errorMessage = 'Operation failed'
    } = options

    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn()

      if (showSuccessToast) {
        toast.success(successMessage)
      }

      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (err) {
      console.error('Async operation error:', err)
      setError(err)

      if (showErrorToast) {
        toast.error(err.message || errorMessage)
      }

      if (onError) {
        onError(err)
      }

      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
  }, [])

  return {
    loading,
    error,
    execute,
    reset
  }
}

/**
 * Custom hook for API calls with authentication
 */
export function useApiCall(makeAuthenticatedRequest) {
  const { execute, loading, error, reset } = useAsyncOperation()

  const call = useCallback(async (url, options = {}, operationOptions = {}) => {
    return execute(async () => {
      const response = await makeAuthenticatedRequest(url, options)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      return response.json()
    }, operationOptions)
  }, [makeAuthenticatedRequest, execute])

  return {
    call,
    loading,
    error,
    reset
  }
}