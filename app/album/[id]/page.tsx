import { Suspense } from 'react'
import { AlbumPage } from '@/components/pages/AlbumPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading album…</div>}>
      <AlbumPage id={id} />
    </Suspense>
  )
}
