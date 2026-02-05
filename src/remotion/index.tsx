import { Composition, registerRoot } from "remotion";
import { AppMarketVideo } from "./AppMarketVideo";

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AppMarketPromo"
        component={AppMarketVideo}
        durationInFrames={300} // 10 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
