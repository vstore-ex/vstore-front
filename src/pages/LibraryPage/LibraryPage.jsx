import Library from '../AccountPage/Library'

/** Standalone library tab, like the Library tab next to the store in Steam. */
export default function LibraryPage() {
  return (
    <div className="library-page">
      <div className="library-page__inner">
        <Library standalone />
      </div>
    </div>
  )
}
