import Lottie from 'lottie-react';

export default function LottiePlayer({
  animationData,
  loop = true,
  autoplay = true,
  className = '',
}) {
  if (!animationData) {
    return null;
  }

  const classes = ['lottie-player', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        className="lottie-player__animation"
        rendererSettings={{
          preserveAspectRatio: 'xMidYMid meet',
        }}
      />
    </div>
  );
}
