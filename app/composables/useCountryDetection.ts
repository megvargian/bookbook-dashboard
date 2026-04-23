// IP-based country detection composable
export const useCountryDetection = () => {
  const detectedCountry = ref<string>('US') // default to US
  const isDetecting = ref(false)

  const detectCountryFromIP = async () => {
    if (isDetecting.value) return detectedCountry.value

    isDetecting.value = true
    try {
      // Try multiple free IP geolocation services as fallback
      const services = [
        'https://ipapi.co/country_code/',
        'https://ipinfo.io/country',
        'https://api.country.is/'
      ]

      for (const service of services) {
        try {
          let countryCode: string

          if (service.includes('country.is')) {
            const response = await fetch(service)
            const data = await response.json()
            countryCode = data.country
          } else {
            const response = await fetch(service)
            countryCode = await response.text()
          }

          if (countryCode && countryCode.length === 2) {
            detectedCountry.value = countryCode.trim().toUpperCase()
            break
          }
        } catch (e) {
          console.warn(`Country detection service failed: ${service}`, e)
          continue
        }
      }
    } catch (e) {
      console.warn('All country detection services failed, using default US', e)
    } finally {
      isDetecting.value = false
    }

    return detectedCountry.value
  }

  // Auto-detect on client mount
  onMounted(() => {
    if (import.meta.client) {
      detectCountryFromIP()
    }
  })

  return {
    detectedCountry: readonly(detectedCountry),
    isDetecting: readonly(isDetecting),
    detectCountryFromIP
  }
}
