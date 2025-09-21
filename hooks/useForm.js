import { useState, useCallback } from 'react'

/**
 * Custom hook for form state management with validation
 */
export function useForm(initialValues = {}, validationRules = {}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }, [errors])

  const setFieldTouched = useCallback((name, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    const newValue = type === 'checkbox' ? checked : value
    setValue(name, newValue)
  }, [setValue])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setFieldTouched(name, true)
    validateField(name, values[name])
  }, [values])

  const validateField = useCallback((name, value) => {
    const rules = validationRules[name]
    if (!rules) return null

    let error = null

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      error = rules.message || `${name} is required`
    }

    // Min length validation
    if (!error && rules.minLength && value && value.length < rules.minLength) {
      error = rules.message || `${name} must be at least ${rules.minLength} characters`
    }

    // Max length validation
    if (!error && rules.maxLength && value && value.length > rules.maxLength) {
      error = rules.message || `${name} must be less than ${rules.maxLength} characters`
    }

    // Pattern validation
    if (!error && rules.pattern && value && !rules.pattern.test(value)) {
      error = rules.message || `${name} format is invalid`
    }

    // Custom validation
    if (!error && rules.validate && value) {
      error = rules.validate(value, values)
    }

    setErrors(prev => ({ ...prev, [name]: error }))
    return error
  }, [values, validationRules])

  const validate = useCallback(() => {
    const newErrors = {}
    let isValid = true

    Object.keys(validationRules).forEach(name => {
      const error = validateField(name, values[name])
      if (error) {
        newErrors[name] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }, [validateField, values, validationRules])

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const getFieldProps = useCallback((name) => ({
    name,
    value: values[name] || '',
    onChange: handleChange,
    onBlur: handleBlur,
    error: touched[name] && errors[name]
  }), [values, handleChange, handleBlur, touched, errors])

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    handleChange,
    handleBlur,
    validate,
    validateField,
    reset,
    getFieldProps,
    isValid: Object.keys(errors).length === 0,
    hasErrors: Object.values(errors).some(error => error !== null)
  }
}