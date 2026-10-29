-- Launch Your Brand links: the last seeded homepage links that pointed at the
-- homepage section (the Launch section's own button and the "Explore range"
-- reel) now open /launch. Rows an admin already changed are left alone.
UPDATE `HomeSection` SET `linkHref` = '/launch'
  WHERE `key` = 'launch' AND `linkHref` = '/#launch-catalogue';
UPDATE `Reel` SET `linkHref` = '/launch'
  WHERE `key` = 'product-range' AND `linkHref` = '/#launch';
