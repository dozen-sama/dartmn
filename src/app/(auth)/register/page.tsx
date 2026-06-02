import { Metadata } from "next"
import { RegisterForm } from "./RegisterForm"

export const metadata: Metadata = { title: "Бүртгүүлэх" }

export default function RegisterPage() {
  return <RegisterForm />
}
