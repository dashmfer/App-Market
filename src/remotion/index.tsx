import { Composition } from "remotion";
import { AppMarketVideo } from "./AppMarketVideo";

export const RemotionRoot: React.FC = () => {
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
