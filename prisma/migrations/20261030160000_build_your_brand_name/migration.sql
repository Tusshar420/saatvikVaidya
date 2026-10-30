-- "Launch Your Brand" is now "Build Your Brand" everywhere. The seed already
-- uses the new name, but homepage rows seeded earlier still hold the old text.
-- Only rows still showing the old seeded wording change; admin edits stay.
UPDATE `HeroSlide` SET `primaryLabel` = 'Build Your Brand'
  WHERE `key` = 'launch-your-brand' AND `primaryLabel` = 'Launch Your Brand';
UPDATE `HeroSlide` SET `panel` = JSON_SET(`panel`, '$.label', 'Brand Studio')
  WHERE `key` = 'launch-your-brand'
    AND JSON_UNQUOTE(JSON_EXTRACT(`panel`, '$.label')) = 'Launch Studio';
UPDATE `HomeSection` SET `eyebrow` = 'BUILD YOUR BRAND'
  WHERE `key` = 'launch' AND `eyebrow` = 'LAUNCH YOUR BRAND';
UPDATE `Reel` SET `mediaLabel` = 'Play Build Your Brand reel'
  WHERE `key` = 'brand-launch' AND `mediaLabel` = 'Play Launch Your Brand reel';
UPDATE `Reel` SET `badge` = 'BUILD YOUR BRAND'
  WHERE `key` = 'brand-launch' AND `badge` = 'LAUNCH YOUR BRAND';
UPDATE `Offer` SET `linkLabel` = 'Build your brand'
  WHERE `key` = 'private-label' AND `linkLabel` = 'Launch your brand';
UPDATE `QuickAction` SET `title` = 'Build Your Brand'
  WHERE `key` = 'launch-your-brand' AND `title` = 'Launch Your Brand';
-- The header's popular searches: rename just that entry, keep the rest.
UPDATE `Setting`
  SET `value` = REPLACE(`value`, '"Launch Your Brand"', '"Build Your Brand"')
  WHERE `key` = 'search.popular'
    AND JSON_CONTAINS(`value`, '"Launch Your Brand"');
