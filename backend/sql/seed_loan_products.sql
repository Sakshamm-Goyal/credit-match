-- Seed sample loan products for Loan Eligibility Engine
-- These products simulate real Indian bank personal loan offerings

INSERT INTO loan_products (
    provider_name, product_name,
    income_range, credit_range, age_range, employment_types,
    interest_rate_min, interest_rate_max,
    loan_amount_min, loan_amount_max,
    processing_fee_percent, tenure_months,
    raw_criteria_text, special_conditions,
    source_url, is_active
) VALUES
-- HDFC Bank Personal Loan
('HDFC Bank', 'Personal Loan for Salaried',
 '[25000,)'::int4range, '[750,900]'::int4range, '[21,60]'::int4range,
 ARRAY['Salaried'],
 10.50, 21.00, 50000, 4000000, 2.50, ARRAY[12,24,36,48,60],
 'Minimum income Rs.25,000, Credit score 750+, Age 21-60 years',
 'Minimum 2 years in current job, 3 years total work experience',
 'https://www.hdfcbank.com/personal/loans/personal-loan', true),

-- ICICI Bank Personal Loan
('ICICI Bank', 'Instant Personal Loan',
 '[30000,)'::int4range, '[700,900]'::int4range, '[23,58]'::int4range,
 ARRAY['Salaried', 'Self-Employed'],
 10.75, 19.00, 50000, 5000000, 2.00, ARRAY[12,24,36,48,60,72],
 'Minimum income Rs.30,000, Credit score 700+, Age 23-58 years',
 'Pre-approved for existing customers with salary account',
 'https://www.icicibank.com/personal-banking/loans/personal-loan', true),

-- Bajaj Finserv Personal Loan
('Bajaj Finserv', 'Insta Personal Loan',
 '[22000,)'::int4range, '[685,900]'::int4range, '[21,67]'::int4range,
 ARRAY['Salaried', 'Self-Employed', 'Business'],
 11.00, 24.00, 50000, 2500000, 3.00, ARRAY[12,24,36,48,60],
 'Minimum income Rs.22,000, Credit score 685+, Age 21-67 years',
 NULL,
 'https://www.bajajfinserv.in/personal-loan', true),

-- Axis Bank Personal Loan
('Axis Bank', 'Personal Loan',
 '[25000,)'::int4range, '[700,900]'::int4range, '[21,60]'::int4range,
 ARRAY['Salaried'],
 10.49, 22.00, 50000, 4000000, 2.00, ARRAY[12,24,36,48,60,72,84],
 'Minimum income Rs.25,000, Credit score 700+, Age 21-60 years',
 'Minimum 1 year in current job',
 'https://www.axisbank.com/retail/loans/personal-loan', true),

-- Kotak Mahindra Personal Loan
('Kotak Mahindra Bank', 'Personal Loan',
 '[25000,)'::int4range, '[750,900]'::int4range, '[21,60]'::int4range,
 ARRAY['Salaried', 'Self-Employed'],
 10.99, 24.00, 50000, 2500000, 2.50, ARRAY[12,24,36,48,60],
 'Minimum income Rs.25,000, Credit score 750+, Age 21-60 years',
 'ITR required for self-employed, minimum 3 years business vintage',
 'https://www.kotak.com/en/personal-banking/loans/personal-loan.html', true),

-- Tata Capital Personal Loan
('Tata Capital', 'Personal Loan',
 '[20000,)'::int4range, '[650,900]'::int4range, '[22,58]'::int4range,
 ARRAY['Salaried', 'Self-Employed'],
 10.99, 19.00, 75000, 3500000, 2.50, ARRAY[12,24,36,48,60,72],
 'Minimum income Rs.20,000, Credit score 650+, Age 22-58 years',
 NULL,
 'https://www.tatacapital.com/personal-loan.html', true),

-- Standard Chartered Personal Loan
('Standard Chartered', 'Personal Loan',
 '[30000,)'::int4range, '[700,900]'::int4range, '[21,65]'::int4range,
 ARRAY['Salaried'],
 11.49, 18.00, 100000, 3000000, 2.00, ARRAY[12,24,36,48,60],
 'Minimum income Rs.30,000, Credit score 700+, Age 21-65 years',
 'Only for metro cities: Mumbai, Delhi, Bangalore, Chennai, Pune, Hyderabad',
 'https://www.sc.com/in/loans/personal-loan/', true),

-- YES Bank Personal Loan
('YES Bank', 'Personal Loan',
 '[25000,)'::int4range, '[720,900]'::int4range, '[21,60]'::int4range,
 ARRAY['Salaried', 'Self-Employed'],
 10.99, 20.00, 100000, 4000000, 2.50, ARRAY[12,24,36,48,60],
 'Minimum income Rs.25,000, Credit score 720+, Age 21-60 years',
 'Minimum 1 year employment, 2 years for self-employed',
 'https://www.yesbank.in/personal-banking/loans/personal-loan', true),

-- Fullerton India Personal Loan
('Fullerton India', 'Personal Loan',
 '[15000,)'::int4range, '[650,900]'::int4range, '[21,58]'::int4range,
 ARRAY['Salaried', 'Self-Employed', 'Business'],
 11.99, 36.00, 50000, 2500000, 3.00, ARRAY[12,24,36,48,60],
 'Minimum income Rs.15,000, Credit score 650+, Age 21-58 years',
 NULL,
 'https://www.fullertonindia.com/personal-loan.aspx', true),

-- IndusInd Bank Personal Loan
('IndusInd Bank', 'Personal Loan',
 '[25000,)'::int4range, '[700,900]'::int4range, '[21,60]'::int4range,
 ARRAY['Salaried', 'Self-Employed'],
 10.49, 26.00, 50000, 5000000, 1.50, ARRAY[12,24,36,48,60,72,84],
 'Minimum income Rs.25,000, Credit score 700+, Age 21-60 years',
 'Pre-approved offers for existing customers',
 'https://www.indusind.com/in/en/personal/loans/personal-loan.html', true)
ON CONFLICT (provider_name, product_name) DO UPDATE SET
    income_range = EXCLUDED.income_range,
    credit_range = EXCLUDED.credit_range,
    age_range = EXCLUDED.age_range,
    employment_types = EXCLUDED.employment_types,
    interest_rate_min = EXCLUDED.interest_rate_min,
    interest_rate_max = EXCLUDED.interest_rate_max,
    loan_amount_min = EXCLUDED.loan_amount_min,
    loan_amount_max = EXCLUDED.loan_amount_max,
    is_active = EXCLUDED.is_active,
    last_updated = CURRENT_TIMESTAMP;
