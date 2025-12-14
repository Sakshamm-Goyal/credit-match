-- Loan Eligibility Engine - Seed Data for Loan Products
-- Version: 1.0.0
-- Sample loan products from various Indian banks and NBFCs

INSERT INTO loan_products (
    provider_name, product_name,
    income_range, credit_range, age_range, employment_types,
    interest_rate_min, interest_rate_max,
    loan_amount_min, loan_amount_max,
    processing_fee_percent, tenure_months,
    special_conditions, source_url
) VALUES
-- HDFC Bank Products
(
    'HDFC Bank', 'Personal Loan Express',
    '[25000,)', '[700,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed'],
    10.50, 21.00,
    50000, 4000000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan'
),
(
    'HDFC Bank', 'Personal Loan Premium',
    '[50000,)', '[750,900]', '[25,55]', ARRAY['Salaried'],
    10.25, 16.00,
    100000, 5000000,
    1.50, ARRAY[12, 24, 36, 48, 60, 72],
    'Minimum 3 years work experience required',
    'https://www.hdfcbank.com/personal/borrow/popular-loans/personal-loan'
),
-- ICICI Bank Products
(
    'ICICI Bank', 'Instant Personal Loan',
    '[20000,)', '[680,900]', '[23,58]', ARRAY['Salaried', 'Self-Employed', 'Business'],
    10.75, 19.00,
    50000, 2500000,
    2.00, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.icicibank.com/personal-banking/loans/personal-loan'
),
(
    'ICICI Bank', 'Personal Loan for Professionals',
    '[40000,)', '[720,900]', '[25,60]', ARRAY['Self-Employed'],
    10.50, 17.50,
    100000, 5000000,
    1.75, ARRAY[12, 24, 36, 48, 60, 72, 84],
    'Only for doctors, CAs, architects, and lawyers',
    'https://www.icicibank.com/personal-banking/loans/personal-loan'
),
-- SBI Products
(
    'State Bank of India', 'Xpress Credit',
    '[15000,)', '[650,900]', '[21,58]', ARRAY['Salaried'],
    11.00, 14.50,
    25000, 2000000,
    1.50, ARRAY[12, 24, 36, 48, 60, 72, 84],
    NULL,
    'https://sbi.co.in/web/personal-banking/loans/personal-loans'
),
(
    'State Bank of India', 'Pension Loan',
    '[10000,)', '[600,900]', '[60,76]', ARRAY['Salaried'],
    10.50, 12.50,
    25000, 1400000,
    0.50, ARRAY[12, 24, 36, 48, 60, 72, 84],
    'Only for SBI pensioners',
    'https://sbi.co.in/web/personal-banking/loans/personal-loans'
),
-- Axis Bank Products
(
    'Axis Bank', 'Personal Loan',
    '[25000,)', '[700,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed'],
    10.49, 22.00,
    50000, 4000000,
    2.00, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.axisbank.com/retail/loans/personal-loan'
),
(
    'Axis Bank', 'Super Saver Loan',
    '[75000,)', '[750,900]', '[25,55]', ARRAY['Salaried'],
    10.25, 14.00,
    200000, 5000000,
    1.00, ARRAY[12, 24, 36, 48, 60, 72],
    'Minimum 5 years work experience and salary account with Axis Bank',
    'https://www.axisbank.com/retail/loans/personal-loan'
),
-- Bajaj Finserv Products
(
    'Bajaj Finserv', 'Personal Loan',
    '[25000,)', '[685,900]', '[21,67]', ARRAY['Salaried', 'Self-Employed', 'Business'],
    11.00, 39.00,
    100000, 3500000,
    3.00, ARRAY[12, 24, 36, 48, 60, 72, 84],
    NULL,
    'https://www.bajajfinserv.in/personal-loan'
),
(
    'Bajaj Finserv', 'Flexi Personal Loan',
    '[35000,)', '[720,900]', '[23,60]', ARRAY['Salaried'],
    11.50, 22.00,
    100000, 2500000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    'Withdraw and repay anytime facility',
    'https://www.bajajfinserv.in/flexi-personal-loan'
),
-- Tata Capital Products
(
    'Tata Capital', 'Personal Loan',
    '[20000,)', '[675,900]', '[21,58]', ARRAY['Salaried', 'Self-Employed'],
    10.99, 29.00,
    75000, 3500000,
    2.50, ARRAY[12, 24, 36, 48, 60, 72],
    NULL,
    'https://www.tatacapital.com/personal-loan.html'
),
-- Kotak Mahindra Bank Products
(
    'Kotak Mahindra Bank', 'Personal Loan',
    '[25000,)', '[700,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed'],
    10.99, 24.00,
    50000, 4000000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.kotak.com/en/personal-banking/loans/personal-loan.html'
),
(
    'Kotak Mahindra Bank', 'Priority Personal Loan',
    '[100000,)', '[780,900]', '[25,55]', ARRAY['Salaried'],
    10.25, 14.00,
    500000, 7500000,
    1.00, ARRAY[12, 24, 36, 48, 60, 72],
    'Only for Kotak Privy League customers with 2+ year relationship',
    'https://www.kotak.com/en/personal-banking/loans/personal-loan.html'
),
-- IndusInd Bank Products
(
    'IndusInd Bank', 'Personal Loan',
    '[25000,)', '[680,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed', 'Business'],
    10.49, 26.00,
    50000, 3000000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.indusind.com/in/en/personal/loans/personal-loan.html'
),
-- Yes Bank Products
(
    'Yes Bank', 'Personal Loan',
    '[30000,)', '[700,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed'],
    10.99, 20.00,
    100000, 4000000,
    2.00, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.yesbank.in/personal-banking/yes-individual/loans/personal-loan'
),
-- IDFC First Bank Products
(
    'IDFC First Bank', 'Personal Loan',
    '[20000,)', '[680,900]', '[23,58]', ARRAY['Salaried', 'Self-Employed'],
    10.49, 24.00,
    20000, 4000000,
    2.00, ARRAY[12, 24, 36, 48, 60, 72],
    NULL,
    'https://www.idfcfirstbank.com/personal-banking/loans/personal-loan'
),
-- RBL Bank Products
(
    'RBL Bank', 'Personal Loan',
    '[25000,)', '[690,900]', '[23,60]', ARRAY['Salaried', 'Self-Employed'],
    14.00, 24.00,
    50000, 2000000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.rblbank.com/personal-banking/loans/personal-loan'
),
-- Fullerton India Products
(
    'Fullerton India', 'Personal Loan',
    '[15000,)', '[650,900]', '[21,60]', ARRAY['Salaried', 'Self-Employed', 'Business'],
    11.99, 36.00,
    50000, 2500000,
    3.00, ARRAY[12, 24, 36, 48],
    NULL,
    'https://www.fullertonindia.com/personal-loan.aspx'
),
-- L&T Finance Products
(
    'L&T Finance', 'Personal Loan',
    '[20000,)', '[660,900]', '[21,58]', ARRAY['Salaried', 'Self-Employed'],
    12.00, 28.00,
    50000, 2500000,
    2.50, ARRAY[12, 24, 36, 48, 60],
    NULL,
    'https://www.ltfs.com/loans/personal-loans.html'
),
-- MoneyTap Products
(
    'MoneyTap', 'Personal Line of Credit',
    '[20000,)', '[650,900]', '[21,57]', ARRAY['Salaried'],
    13.00, 36.00,
    3000, 500000,
    2.00, ARRAY[2, 3, 6, 12, 24, 36],
    'App-based credit line with flexible withdrawals',
    'https://www.moneytap.com/'
)
ON CONFLICT (provider_name, product_name) DO UPDATE SET
    income_range = EXCLUDED.income_range,
    credit_range = EXCLUDED.credit_range,
    age_range = EXCLUDED.age_range,
    employment_types = EXCLUDED.employment_types,
    interest_rate_min = EXCLUDED.interest_rate_min,
    interest_rate_max = EXCLUDED.interest_rate_max,
    loan_amount_min = EXCLUDED.loan_amount_min,
    loan_amount_max = EXCLUDED.loan_amount_max,
    processing_fee_percent = EXCLUDED.processing_fee_percent,
    tenure_months = EXCLUDED.tenure_months,
    special_conditions = EXCLUDED.special_conditions,
    source_url = EXCLUDED.source_url,
    last_updated = CURRENT_TIMESTAMP;
