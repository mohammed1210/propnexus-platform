-- Seed data for tradesmen tables
-- This provides sample tradespeople across UK for demonstration purposes

-- Insert sample tradesmen across different UK cities
INSERT INTO tradesmen (full_name, trade_type, email, phone, website, rating, latitude, longitude, service_radius_km) VALUES
-- London area
('John Smith Construction', 'builder', 'john@smithconstruction.co.uk', '020 7123 4567', 'www.smithconstruction.co.uk', 4.8, 51.5074, -0.1278, 25),
('Thames Plumbing Services', 'plumber', 'info@thamesplumbing.co.uk', '020 7234 5678', 'www.thamesplumbing.co.uk', 4.5, 51.5155, -0.0922, 20),
('Capital Electricians Ltd', 'electrician', 'service@capitalelectricians.co.uk', '020 7345 6789', 'www.capitalelectricians.co.uk', 4.7, 51.5074, -0.1278, 30),
('London Roofing Experts', 'roofer', 'info@londonroofing.co.uk', '020 7456 7890', 'www.londonroofing.co.uk', 4.6, 51.5200, -0.1000, 35),
('Premier Property Surveyors', 'surveyor', 'contact@premiersurveyor.co.uk', '020 7567 8901', 'www.premiersurveyor.co.uk', 4.9, 51.5074, -0.1278, 50),

-- Manchester area
('Manchester Master Builders', 'builder', 'info@manchesterbuilders.co.uk', '0161 123 4567', 'www.manchesterbuilders.co.uk', 4.6, 53.4808, -2.2426, 30),
('Northern Plumbing Solutions', 'plumber', 'enquiries@northernplumbing.co.uk', '0161 234 5678', 'www.northernplumbing.co.uk', 4.4, 53.4839, -2.2446, 25),
('Manchester Electricals', 'electrician', 'service@manchesterelectricals.co.uk', '0161 345 6789', NULL, 4.3, 53.4808, -2.2426, 20),

-- Birmingham area
('Birmingham Building Services', 'builder', 'info@birminghambuilding.co.uk', '0121 123 4567', 'www.birminghambuilding.co.uk', 4.5, 52.4862, -1.8904, 25),
('Midlands Plumbing & Heating', 'plumber', 'contact@midlandsplumbing.co.uk', '0121 234 5678', 'www.midlandsplumbing.co.uk', 4.7, 52.4862, -1.8904, 30),
('West Midlands Electricians', 'electrician', 'info@wmelec.co.uk', '0121 345 6789', NULL, 4.4, 52.4800, -1.9025, 20),
('Birmingham Roofing Co', 'roofer', 'enquiries@bhamroofing.co.uk', '0121 456 7890', 'www.bhamroofing.co.uk', 4.6, 52.4862, -1.8904, 40),

-- Liverpool area
('Merseyside Builders Ltd', 'builder', 'info@merseysidebuilders.co.uk', '0151 123 4567', NULL, 4.3, 53.4084, -2.9916, 25),
('Liverpool Plumbing Services', 'plumber', 'service@liverpoolplumbing.co.uk', '0151 234 5678', 'www.liverpoolplumbing.co.uk', 4.5, 53.4084, -2.9916, 20),
('Scouse Sparky Electricians', 'electrician', 'info@scousesparky.co.uk', '0151 345 6789', 'www.scousesparky.co.uk', 4.8, 53.4084, -2.9916, 30),

-- Leeds area
('Yorkshire Construction Group', 'builder', 'info@yorkshireconstruction.co.uk', '0113 123 4567', 'www.yorkshireconstruction.co.uk', 4.7, 53.8008, -1.5491, 35),
('Leeds Plumbing & Gas', 'plumber', 'contact@leedsplumbing.co.uk', '0113 234 5678', NULL, 4.2, 53.8008, -1.5491, 25),
('White Rose Electricals', 'electrician', 'service@whiteroseelec.co.uk', '0113 345 6789', 'www.whiteroseelec.co.uk', 4.6, 53.7997, -1.5492, 20),
('Yorkshire Roofing Specialists', 'roofer', 'info@yorkshireroofing.co.uk', '0113 456 7890', 'www.yorkshireroofing.co.uk', 4.5, 53.8008, -1.5491, 30),

-- Bristol area
('Bristol Building Contractors', 'builder', 'info@bristolbuilding.co.uk', '0117 123 4567', 'www.bristolbuilding.co.uk', 4.4, 51.4545, -2.5879, 25),
('West Country Plumbers', 'plumber', 'contact@westcountryplumbers.co.uk', '0117 234 5678', 'www.westcountryplumbers.co.uk', 4.6, 51.4545, -2.5879, 30),
('Bristol Electrical Services', 'electrician', 'service@bristolelec.co.uk', '0117 345 6789', NULL, 4.3, 51.4545, -2.5879, 20),

-- Edinburgh area
('Edinburgh Master Tradesmen', 'builder', 'info@edinburghtradesmen.co.uk', '0131 123 4567', 'www.edinburghtradesmen.co.uk', 4.8, 55.9533, -3.1883, 30),
('Scottish Plumbing Solutions', 'plumber', 'enquiries@scottishplumbing.co.uk', '0131 234 5678', 'www.scottishplumbing.co.uk', 4.7, 55.9533, -3.1883, 25),
('Capital City Electricians', 'electrician', 'info@capitalcityelec.co.uk', '0131 345 6789', 'www.capitalcityelec.co.uk', 4.5, 55.9533, -3.1883, 20),
('Edinburgh Roofing Services', 'roofer', 'service@edinburghroofing.co.uk', '0131 456 7890', NULL, 4.6, 55.9533, -3.1883, 35),

-- Glasgow area
('Glasgow Construction Group', 'builder', 'info@glasgowconstruction.co.uk', '0141 123 4567', 'www.glasgowconstruction.co.uk', 4.5, 55.8642, -4.2518, 30),
('Clyde Plumbing & Heating', 'plumber', 'contact@clydeplumbing.co.uk', '0141 234 5678', 'www.clydeplumbing.co.uk', 4.4, 55.8642, -4.2518, 25),

-- Newcastle area
('Geordie Builders Ltd', 'builder', 'info@geordiebuilders.co.uk', '0191 123 4567', NULL, 4.3, 54.9783, -1.6178, 25),
('Tyne & Wear Plumbing', 'plumber', 'service@tyneplumbing.co.uk', '0191 234 5678', 'www.tyneplumbing.co.uk', 4.5, 54.9783, -1.6178, 30),
('Newcastle Electricals', 'electrician', 'info@newcastleelec.co.uk', '0191 345 6789', 'www.newcastleelec.co.uk', 4.6, 54.9783, -1.6178, 20);

-- Insert sample reviews for some tradesmen
-- Note: user_id is set to NULL as we don't have actual users in this seed
INSERT INTO tradesmen_reviews (tradesman_id, user_id, rating, review)
SELECT
    id,
    NULL,
    5,
    'Excellent work, very professional and completed on time. Highly recommended!'
FROM tradesmen
WHERE full_name = 'John Smith Construction';

INSERT INTO tradesmen_reviews (tradesman_id, user_id, rating, review)
SELECT
    id,
    NULL,
    4,
    'Good service, prompt response and fair pricing.'
FROM tradesmen
WHERE full_name = 'Thames Plumbing Services';

INSERT INTO tradesmen_reviews (tradesman_id, user_id, rating, review)
SELECT
    id,
    NULL,
    5,
    'Outstanding electrician, very knowledgeable and tidy.'
FROM tradesmen
WHERE full_name = 'Capital Electricians Ltd';

INSERT INTO tradesmen_reviews (tradesman_id, user_id, rating, review)
SELECT
    id,
    NULL,
    5,
    'Best surveyor we have used. Thorough report and excellent advice.'
FROM tradesmen
WHERE full_name = 'Premier Property Surveyors';

INSERT INTO tradesmen_reviews (tradesman_id, user_id, rating, review)
SELECT
    id,
    NULL,
    4,
    'Did a great job on our loft conversion. Minor delays but quality work.'
FROM tradesmen
WHERE full_name = 'Manchester Master Builders';

-- Display summary
SELECT
    trade_type,
    COUNT(*) as count,
    ROUND(AVG(rating)::numeric, 2) as avg_rating
FROM tradesmen
GROUP BY trade_type
ORDER BY count DESC;

SELECT COUNT(*) as total_tradesmen FROM tradesmen;
SELECT COUNT(*) as total_reviews FROM tradesmen_reviews;
