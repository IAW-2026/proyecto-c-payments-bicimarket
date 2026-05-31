export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 rounded-xl border p-8">
          <div className="sk" style={{ width: 48, height: 48, borderRadius: 12 }} />
          <div className="sk" style={{ width: 180, height: 24 }} />
          <div className="sk" style={{ width: 240, height: 14 }} />
          <div className="sk" style={{ width: "100%", height: 48, borderRadius: 8, marginTop: 8 }} />
        </div>
      </div>
    </div>
  )
}
