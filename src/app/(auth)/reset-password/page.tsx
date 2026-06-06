import { Metadata } from "next"
import { Suspense } from "react"
import { ResetPasswordForm } from "./ResetPasswordForm"

export const metadata: Metadata = { title: "Нууц үг өөрчлөх" }

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
