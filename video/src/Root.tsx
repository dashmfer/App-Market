import { Composition } from "remotion";
import { SecurityShowcase } from "./SecurityShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SecurityShowcase"
        component={SecurityShowcase}
        durationInFrames={30 * 60} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
