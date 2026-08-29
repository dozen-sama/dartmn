// payment_transactions.provider-ийн боломжит утгууд — DB CHECK constraint-тай
// (supabase/migrations/20260829120100_add_byl_payment_provider.sql) яг тохирсон
// байх ёстой тул шинэ provider нэмэхдээ энд болон тухайн migration-д хоёуланд нь
// нэмнэ.
export const PAYMENT_PROVIDERS = ["qpay", "socialpay", "byl"] as const

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]
