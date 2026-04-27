interface Props {
  params: Promise<{ mint: string }>
}

export default async function TokenPage({ params }: Props) {
  const { mint } = await params
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white">Token Deep-Dive</h1>
      <p className="text-[#555] text-sm mt-2 font-mono">{mint}</p>
      <p className="text-[#555] text-sm mt-2">Implemented in Plan 6.</p>
    </div>
  )
}
