export default function YouTubePlayer({ youtubeId, title }: { youtubeId: string; title: string }) {
  return (
    <div className="aspect-video-box overflow-hidden rounded-2xl border border-olive/15 bg-black shadow-card">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
