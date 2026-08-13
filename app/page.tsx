import { Suspense } from 'react'
import { HomePage } from '@/components/pages/HomePage'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
      <HomePage />
    </Suspense>
  )
}
