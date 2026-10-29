package domain

// PlatformDeliveryFeeKobo is the fallback delivery fee when a seller has not
// configured their own delivery zones: ₦1,500, the same fee order checkout
// charges below the free-delivery threshold.
const PlatformDeliveryFeeKobo int64 = 150_000
