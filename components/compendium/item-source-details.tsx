type ItemSourceDetailsProps = {
  item: { source?: string | null; creator_url?: string | null }
}

/** Source citations may be a URL or freeform bibliographic notes. */
export function ItemSourceDetails({ item }: ItemSourceDetailsProps) {
  const source = item.source?.trim()
  const details = item.creator_url?.trim()
  if (!source && !details) return null

  return (
    <div className="mt-5 border-t border-white/20 pt-4 text-sm leading-relaxed">
      {source ? <p><span className="font-semibold">Source: </span>{source}</p> : null}
      {details ? (
        <p className="mt-1">
          <span className="font-semibold">Source details: </span>
          {/^https?:\/\/\S+$/i.test(details) ? (
            <a href={details} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-white underline underline-offset-4 hover:text-white/80 focus-visible:outline-2 focus-visible:outline-offset-2">
              {details}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : <span className="whitespace-pre-wrap break-words">{details}</span>}
        </p>
      ) : null}
    </div>
  )
}
