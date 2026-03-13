import { Composition, registerRoot } from "remotion";
import React from "react";
import { AppMarketVideo } from "./AppMarketVideo";
import { BeatTestVideo } from "./BeatTest";
import { PromoVideoCall } from "./PromoVideoCall";
import { MainnetDelayParody } from "./MainnetDelayParody";
import { RealPeoplePromo } from "./RealPeoplePromo";
import {
  TitleMain, TitleLine, TitleSubtitle,
  ProblemLine1, ProblemLine2, ProblemLine3,
  SellerTitle, SellerIcon1, SellerIcon2, SellerIcon3, SellerIcon4, SellerIcon5,
  BuyerTitle, BuyerFeature1, BuyerFeature2, BuyerFeature3, BuyerFeature4,
  TrustTitle, TrustSeller, TrustArrow, TrustEscrow, TrustBuyer,
  Stat1, Stat2, Stat3, Stat4,
  CTALogo, CTAText, CTAButton, CTAMainnet, CTAMoreInfo,
} from "./IndividualElements";

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="AppMarketPromo" component={AppMarketVideo} durationInFrames={900} fps={30} width={1920} height={1080} />
      <Composition id="PromoVideoCall" component={PromoVideoCall} durationInFrames={1620} fps={30} width={1920} height={1080} />
      <Composition id="BeatTest" component={BeatTestVideo} durationInFrames={900} fps={30} width={1920} height={1080} />
      <Composition id="MainnetDelayParody" component={MainnetDelayParody} durationInFrames={1150} fps={30} width={1920} height={1080} />
      <Composition id="RealPeoplePromo" component={RealPeoplePromo} durationInFrames={1620} fps={30} width={1920} height={1080} />

      {/* Individual elements - 30 frames each (1 second) */}
      <Composition id="E01-TitleMain" component={TitleMain} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E02-TitleLine" component={TitleLine} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E03-TitleSubtitle" component={TitleSubtitle} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E04-ProblemLine1" component={ProblemLine1} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E05-ProblemLine2" component={ProblemLine2} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E06-ProblemLine3" component={ProblemLine3} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E07-SellerTitle" component={SellerTitle} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E08-SellerIcon1" component={SellerIcon1} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E09-SellerIcon2" component={SellerIcon2} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E10-SellerIcon3" component={SellerIcon3} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E11-SellerIcon4" component={SellerIcon4} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E12-SellerIcon5" component={SellerIcon5} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E13-BuyerTitle" component={BuyerTitle} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E14-BuyerFeature1" component={BuyerFeature1} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E15-BuyerFeature2" component={BuyerFeature2} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E16-BuyerFeature3" component={BuyerFeature3} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E17-BuyerFeature4" component={BuyerFeature4} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E18-TrustTitle" component={TrustTitle} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E19-TrustSeller" component={TrustSeller} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E20-TrustArrow" component={TrustArrow} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E21-TrustEscrow" component={TrustEscrow} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E22-TrustBuyer" component={TrustBuyer} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E23-Stat1" component={Stat1} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E24-Stat2" component={Stat2} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E25-Stat3" component={Stat3} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E26-Stat4" component={Stat4} durationInFrames={30} fps={30} width={1920} height={1080} />

      <Composition id="E27-CTALogo" component={CTALogo} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E28-CTAText" component={CTAText} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E29-CTAButton" component={CTAButton} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E30-CTAMainnet" component={CTAMainnet} durationInFrames={30} fps={30} width={1920} height={1080} />
      <Composition id="E31-CTAMoreInfo" component={CTAMoreInfo} durationInFrames={30} fps={30} width={1920} height={1080} />
    </>
  );
};

registerRoot(RemotionRoot);
