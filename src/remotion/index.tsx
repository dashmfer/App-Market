import { Composition, registerRoot } from "remotion";
import { AppMarketVideo } from "./AppMarketVideo";
import { BeatTestVideo } from "./BeatTest";

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AppMarketPromo"
        component={AppMarketVideo}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="BeatTest"
        component={BeatTestVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
