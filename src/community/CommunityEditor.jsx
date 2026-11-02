import { useId, useRef, useState } from 'react'
import {
  ARTWORK_IMAGE_TYPES,
  saveCommunityItem,
  uploadArtworkImage,
  validateArtworkFile,
} from '../api/community'
import useCommunityTask from './useCommunityTask'
import { CommunityError } from './CommunityParts'

export default function CommunityEditor({ kind, gameId, item, onSaved, onCancel }) {
  const artwork = kind === 'artwork'
  const [title, setTitle] = useState(item?.title || '')
  const [content, setContent] = useState((artwork ? item?.description_md : item?.content_md) || '')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [uploaded, setUploaded] = useState(null)
  const upload = useRef(null)
  const id = useId()
  const task = useCommunityTask()
  function selectImage(event) {
    const next = event.target.files?.[0]
    setFile(null)
    setFileError(null)
    setUploaded(null)
    upload.current = null
    if (!next) return
    try {
      validateArtworkFile(next)
      setFile(next)
    } catch (error) {
      setFileError(error)
      event.target.value = ''
    }
  }
  function submit(event) {
    event.preventDefault()
    task.run(async (signal) => {
      let image = item?.image_url
      if (file) {
        image =
          upload.current?.file === file
            ? upload.current.url
            : await uploadArtworkImage(file, gameId, signal)
        signal.throwIfAborted()
        upload.current = { file, url: image }
        setUploaded(file.name)
      }
      return saveCommunityItem(
        kind,
        {
          id: item?.id,
          game_id: gameId,
          title,
          content_md: content,
          description_md: content,
          image_url: image,
        },
        signal,
      )
    }, onSaved)
  }
  return (
    <form
      className="community-editor"
      onSubmit={submit}
      aria-label={(item ? 'Edit ' : 'Create ') + kind}
    >
      <h3>
        {item ? 'Edit' : 'New'} {kind}
      </h3>
      <fieldset disabled={task.busy}>
        <label htmlFor={id + '-title'}>Title</label>
        <input
          id={id + '-title'}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
        {artwork && (
          <>
            <label htmlFor={id + '-image'}>
              {item ? 'Replace image (optional)' : 'Artwork image'}
            </label>
            <input
              id={id + '-image'}
              type="file"
              accept={ARTWORK_IMAGE_TYPES.join(',')}
              onChange={selectImage}
              required={!item && !file}
            />
            <small>JPG, PNG, WebP or GIF, up to 10 MB.</small>
            {uploaded && (
              <p role="status">
                Image uploaded: {uploaded}. Publishing retries will reuse this upload.
              </p>
            )}
          </>
        )}
        <label htmlFor={id + '-content'}>
          {artwork ? 'Description (optional)' : 'Discussion text'}
        </label>
        <textarea
          id={id + '-content'}
          rows={5}
          required={!artwork}
          maxLength={10000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <small>Markdown supported. {content.length}/10000 characters.</small>
        <div className="community-actions">
          <button
            className="button button--accent"
            type="submit"
            disabled={
              !title.trim() ||
              (!artwork && !content.trim()) ||
              !!fileError ||
              (artwork && !item && !file)
            }
          >
            {task.busy ? 'Saving…' : item ? 'Save changes' : 'Publish ' + kind}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
      <CommunityError error={fileError || task.error} />
    </form>
  )
}
