import { Metadata } from "next"
import { Suspense } from "react"
import { ForgotPasswordForm } from "./ForgotPasswordForm"

export const metadata: Metadata = { title: "Нууц үг сэргээх" }

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
