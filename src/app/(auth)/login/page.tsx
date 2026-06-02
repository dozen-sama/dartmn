import { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = { title: "Нэвтрэх" }

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
