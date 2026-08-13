import { Suspense } from 'react'
import { ArtistPage } from '@/components/pages/ArtistPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading artist…</div>}>
      <ArtistPage id={id} />
    </Suspense>
  )
}
