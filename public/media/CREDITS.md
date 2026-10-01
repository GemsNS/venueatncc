# Media credits

## hero-roses.mp4, hero-roses.webm, hero-roses-poster.jpg, hero-roses-poster-portrait.jpg

The home page hero loop: a slow, close view of real pink roses in bloom against a bright white background,
with soft daylight. It shows no identifiable venue, building, room, or person. It replaced the white petals
clip on 2026-10-01 because the client said the petals did not read as flower petals and asked for pink roses.

- Source: Pexels, "Close-up of Beautiful Pink Roses in Bloom" (video 36494699),
  https://www.pexels.com/video/close-up-of-beautiful-pink-roses-in-bloom-36494699/
- Author: Marek Ruczaj (Pexels contributor, https://www.pexels.com/@marek-ruczaj-1534625/)
- License: Pexels License, https://www.pexels.com/license/
  (free for commercial and non-commercial use, modification allowed; no attribution required, kept here for
  the record). The source page carries no AI generated label; it is camera footage.
- Downloaded: 2026-10-01, the 3840 x 2160, 29.97 fps rendition (`15475072_3840_2160_30fps.mp4`, 20.1 s).
- Edit: 1.0 s to 18.0 s of the source, with its last second crossfaded into the first second of the source,
  so the loop ends on the frame it starts with and wraps without a jump; the whole 17 s then played at 1.22x
  speed (the motion is a near-still drift, so the change does not show) to give a 13.96 s loop, 335 frames at
  24 fps, whose last frame matches its first at 38.7 dB PSNR. Grade: gamma 1.5, brightness +0.02, saturation
  1.05 (ffmpeg eq), which lifts the mean HSL lightness of the first frame from 51 to 66 (landscape) and from 44
  to 61 (the 9:16 centre) so a light veil reaches redesign-v7.md's 78 to 90 band without washing the roses
  out. No audio, scaled to 2560 x 1440 (Lanczos).
- Encodes: H.264 (libx264, crf 33, preset veryslow, high profile, yuv420p, faststart, 982,229 bytes) and VP9
  (libvpx-vp9, crf 42, constant quality with b:v 0, row-mt, 455,241 bytes), both 2560 x 1440,
  24 fps. SSIM against the edit master is 0.984 (H.264) and 0.987 (VP9).
- Posters: the loop's first frame (source 1.0 s) as JPEG, 2560 x 1440 (mozjpeg quality 72, 109,864 bytes); the
  portrait poster is the middle 1216 x 2160 of the same 4K source frame with the same grade (76,777 bytes),
  which is what a cover crop shows on portrait screens.

## Earlier: hero-petals (now in design-archive/hero-petals/)

The home hero loop from 2026-09-30 to 2026-10-01: a slow, close view of white rose petals against a soft pink
background. The four files (`hero-petals.mp4`, `hero-petals.webm`, `hero-petals-poster.jpg`,
`hero-petals-poster-portrait.jpg`) moved to `design-archive/hero-petals/` when the roses replaced them.

- Source: Mixkit, "White petals with a pink background" (item 3733),
  https://mixkit.co/free-stock-video/white-petals-with-a-pink-background-3733/
- Author: Ruben Velasco (Mixkit contributor, https://mixkit.co/@rubenvelasco/)
- License: Mixkit Stock Video Free License, https://mixkit.co/license/#videoFree
  (free for commercial and non-commercial use; no attribution required, kept here for the record)
- Downloaded: 2026-10-01, the 3840 x 2160 rendition (3733-2160.mp4), replacing the 1280 x 720 rendition
  (3733-720.mp4) used from 2026-09-30, whose files are kept in `design-archive/hero-petals-1280/`.
- Edit: 1.0 s to 13.0 s of the source, with the last second crossfaded into the first second of the source so
  the loop is seamless (12.0 s), brightness +0.03, saturation 1.08, no audio, scaled to 2560 x 1440 (Lanczos).
- Encodes: H.264 (libx264, crf 30, preset veryslow, high profile, faststart, 652 KB) and VP9 (libvpx-vp9, crf
  38, 177 KB), both 2560 x 1440, 24 fps. The poster is the loop's first frame as JPEG, 2560 x 1440 (56 KB);
  the portrait poster is the middle 1216 x 2160 of the same 4K frame (34 KB), for portrait screens.
