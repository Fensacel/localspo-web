import { Suspense } from 'react'
import { SearchPage } from '@/components/pages/SearchPage'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Searching…</div>}>
      <SearchPage />
    </Suspense>
  )
}
