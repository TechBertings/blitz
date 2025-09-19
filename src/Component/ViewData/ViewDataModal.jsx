import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ViewDataModal.css';

const ViewDataModal = ({ visaCode, onClose }) => {
    const [data, setData] = useState(null);
    const [type, setType] = useState(null);
    const [accountTypeNames, setAccountTypeNames] = useState(null);
    const [distributorName, setDistributorName] = useState(null);

    // New state for the extra tables
    const [accountsBudgetList, setAccountsBudgetList] = useState([]);
    const [skuListing, setSkuListing] = useState([]);

    const coverFieldNameMap = {
        cover_code: 'Cover Code',
        distributor_code: 'Distributor',
        amount_badget: 'Amount Badget',
        pwp_type: 'PWP Type',
        objective: 'Objective',
        promo_scheme: 'Promo Scheme',
        details: 'Details',
        remarks: 'Remarks',
        notification: 'Notification',
        created_at: 'Created At',
        createForm: 'Created Form',
        ispartofcovervisa: 'Is Part of Cover Visa',
        coverVisaCode: 'Cover Visa Code',
        supporttype: 'Support Type',
        distributor: 'Distributor',

        categoryName: 'Category Name',
        sku: 'SKU',
        accounts: 'Accounts',
        amount_display: 'Amount Display',
    };

    const regularFieldNameMap = {
        regularpwpcode: 'Regular PWP Code',
        account_type: 'Account Type',
        activity: 'Activity',
        pwptype: 'PWP Type',
        promoScheme: 'Promo Scheme',
        activityDurationFrom: 'Activity From',
        activityDurationTo: 'Activity To',
        isPartOfCoverPwp: 'Is Part of Cover PWP',
        coverPwpCode: 'Cover PWP Code',
        amountbadget: 'Amount Badget',

        objective: 'Objective',
        promo_scheme: 'Promo Scheme',
        details: 'Details',
        remarks: 'Remarks',
        notification: 'Notification',
        created_at: 'Created At',
        createForm: 'Created Form',
        distributor: 'Distributor',

        categoryName: 'Category Name',
        sku: 'SKU',
        accounts: 'Accounts',
        amount_display: 'Amount Display',
    };

    const formatFieldName = (key) => {
        const map = type === 'Cover PWP' ? coverFieldNameMap : regularFieldNameMap;

        return (
            map[key] ||
            key
                .replace(/_/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\b\w/g, (c) => c.toUpperCase())
        );
    };


    const numberFormatWithCommas = (num) => {
        if (typeof num !== 'number') {
            num = Number(num);
            if (isNaN(num)) return String(num);
        }
        return num.toLocaleString();
    };
    const formatValue = (value, key) => {
        if (!value && value !== false) return '-';

        const lowerKey = key.toLowerCase();

        // 🏷️ ACCOUNT TYPE LOGIC
        if (['account_type', 'accounttype'].includes(lowerKey)) {
            const codes = String(value)
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);

            const names = codes.map((code) => {
                const name = accountTypeNameCache[code];
                if (!name) {
                    // Trigger fetch if not in cache
                    fetchAccountTypeName(code);
                    return code; // fallback while loading
                }
                return name;
            });

            return names.join(', ');
        }

        // 🏷️ DISTRIBUTOR LOGIC
        if (['distributor_code', 'distributor'].includes(lowerKey)) {
            const code = String(value).trim();
            const name = distributorNameCache[code];

            if (!name) {
                // Trigger fetch if not in cache
                fetchDistributorName(code);
                return code; // fallback while loading
            }

            return name;
        }
        if (lowerKey === 'activity') {
            const code = String(value).trim();
            const name = activityNameCache[code];
            if (!name) {
                fetchActivityName(code);
                return code;
            }
            return name;
        }
        // ✅ ARRAY
        if (Array.isArray(value)) return value.join(', ');

        // ✅ BOOLEAN
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';

        // ✅ AMOUNT
        if (['amount_badget', 'amountbadget', 'amount_display'].includes(lowerKey)) {
            const num = Number(value);
            return isNaN(num) ? value : num.toLocaleString();
        }

        // ✅ DATE
        if (lowerKey === 'created_at') {
            try {
                const date = new Date(value);
                const datePart = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }).replace(',', '');

                const timePart = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                });

                return `${datePart} ${timePart}`;
            } catch {
                return String(value);
            }
        }

        return String(value);
    };
    const fetchAccountTypeName = async (code) => {
        try {
            const { data, error } = await supabase
                .from('categorydetails')
                .select('code, name')
                .eq('code', code)
                .single();

            if (!error && data) {
                setAccountTypeNameCache((prev) => ({
                    ...prev,
                    [code]: data.name,
                }));
            }
        } catch (err) {
            console.error('Error fetching account type name:', err.message);
        }
    };

    const fetchDistributorName = async (code) => {
        try {
            const { data, error } = await supabase
                .from('distributors')
                .select('code, name')
                .eq('code', code)
                .single();

            if (!error && data) {
                setDistributorNameCache((prev) => ({
                    ...prev,
                    [code]: data.name,
                }));
            }
        } catch (err) {
            console.error('Error fetching distributor name:', err.message);
        }
    };

    const [activityNameCache, setActivityNameCache] = useState({});


    const [accountTypeNameCache, setAccountTypeNameCache] = useState({});
    const [distributorNameCache, setDistributorNameCache] = useState({});

    const fetchActivityName = async (code) => {
        try {
            const { data, error } = await supabase
                .from('activity')
                .select('code, name')
                .eq('code', code)
                .single();

            if (!error && data) {
                setActivityNameCache(prev => ({
                    ...prev,
                    [code]: data.name,
                }));
            }
        } catch (err) {
            console.error('Error fetching activity name:', err.message);
        }
    };

    // Fetch associated table data
    const fetchAccountsBudget = async (code) => {
        // Use code = regularpwpcode or whatever field in `data`
        const { data: accData, error } = await supabase
            .from('regular_accountlis_badget')
            .select('*')
            .eq('regularcode', code);

        if (error) {
            console.error('Error fetching accounts budget:', error);
            return [];
        }
        return accData;
    };

    const fetchSkuListing = async (code) => {
        const { data: skuData, error } = await supabase
            .from('regular_sku_listing')
            .select('*')
            .eq('regular_code', code);

        if (error) {
            console.error('Error fetching sku listing:', error);
            return [];
        }
        return skuData;
    };

    const fetchAccountTypeNames = async (codesString) => {
        if (!codesString) {
            setAccountTypeNames(null);
            return;
        }

        // 🔧 Normalize to array of strings
        let codeArray = [];

        if (Array.isArray(codesString)) {
            codeArray = codesString.map((c) => String(c).trim());
        } else if (typeof codesString === 'string') {
            codeArray = codesString.split(',').map((c) => c.trim());
        } else {
            console.warn('Unsupported type for accountType:', codesString);
            setAccountTypeNames(null);
            return;
        }

        if (codeArray.length === 0) {
            setAccountTypeNames(null);
            return;
        }

        try {
            const { data: accounts, error } = await supabase
                .from('categorydetails')
                .select('code, name')
                .in('code', codeArray);

            if (error) {
                console.error('Supabase error fetching accounts:', error);
                setAccountTypeNames(null);
                return;
            }

            const nameList = codeArray
                .map((code) => {
                    const found = accounts.find((a) => a.code.toLowerCase() === code.toLowerCase());
                    return found ? found.name : code;
                })
                .join(', ');

            setAccountTypeNames(nameList);
        } catch (err) {
            console.error('Unexpected error fetching account type names:', err.message);
            setAccountTypeNames(null);
        }
    };



    // 🔧 Centralized function to resolve names for Regular PWP
    const resolveRegularNames = async (result) => {
        const accTypeCode = result.accountType;
        const distributorCode = result.distributor;

        if (accTypeCode) {
            await fetchAccountTypeNames(accTypeCode);
        } else {
            setAccountTypeNames(null);
        }

        if (distributorCode) {
            await fetchDistributorName(distributorCode);
        } else {
            setDistributorName(null);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                let result = null;

                if (visaCode.startsWith('C')) {
                    setType('Cover PWP');
                    const { data, error } = await supabase
                        .from('cover_pwp')
                        .select('*')
                        .eq('cover_code', visaCode)
                        .single();
                    if (error) throw error;
                    result = data;
                } else if (visaCode.startsWith('R')) {
                    setType('Regular PWP');
                    const { data, error } = await supabase
                        .from('regular_pwp')
                        .select('*')
                        .eq('regularpwpcode', visaCode)
                        .single();
                    if (error) throw error;
                    result = data;
                }

                setData(result);

                if (result) {
                    // Fetch related tables if Regular PWP with code
                    if (result.regularpwpcode) {
                        const [accBudget, skuList] = await Promise.all([
                            fetchAccountsBudget(result.regularpwpcode),
                            fetchSkuListing(result.regularpwpcode),
                        ]);
                        setAccountsBudgetList(accBudget);
                        setSkuListing(skuList);
                    } else {
                        setAccountsBudgetList([]);
                        setSkuListing([]);
                    }

                    // Fetch and set Account Type names (async)
                    if (result.account_type || result.accountType) {
                        await fetchAccountTypeNames(result.account_type || result.accountType);
                    } else {
                        setAccountTypeNames(null);
                    }

                    if (result.distributor_code || result.distributor) {
                        await fetchDistributorName(result.distributor_code || result.distributor);
                    } else {
                        setDistributorName(null);
                    }
                    if (type === 'Regular PWP') {
                        await resolveRegularNames(result);
                    }

                }
            } catch (error) {
                console.error('Error fetching data:', error.message);

                // Reset states on error
                setAccountTypeNames(null);
                setDistributorName(null);
                setAccountsBudgetList([]);
                setSkuListing([]);
            }
        };

        if (visaCode) {
            fetchData();
        }
    }, [visaCode]);


    if (!data) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <div className="modal-header">
                    <h2>
                        View {type} - {visaCode}
                    </h2>
                </div>

                <div className="modal-content-scrollable">
                    <div className="modal-form-content">


                        {/* ✅ Rest of the Form Fields */}
                        {Object.entries(data)
                            .filter(([key, value]) => {
                                if (['objective', 'promo_scheme', 'remarks', 'notification', 'amount_badget'].includes(key)) return false;

                                if (
                                    type === 'Regular PWP' &&
                                    ['amount_badget', 'amountbadget', 'promoScheme', 'coverVisaCode', 'notification', 'categoryCode', 'credit_budget', 'remaining_balance', 'sku'].includes(key)
                                ) return false;

                                if (key.toLowerCase() === 'accounts') return accountsBudgetList.length > 0;

                                if (key.toLowerCase() === 'sku') return skuListing.length > 0;

                                if (key.toLowerCase() === 'amount_display') return value === true || value === 'Yes';

                                return true;
                            })
                            .map(([key, value]) => (
                                <div className="form-group" key={key}>
                                    <label>{formatFieldName(key)}</label>
                                    <div className="readonly-box">
                                        {key.toLowerCase() === 'accounts' && accountsBudgetList.length > 0 ? (
                                            <div>
                                                {accountsBudgetList.map((row) => (
                                                    <div key={row.id}>
                                                        {row.account_name} — {row.budget}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : key.toLowerCase() === 'sku' && skuListing.length > 0 ? (
                                            <div>
                                                {skuListing.map((row) => (
                                                    <div key={row.id}>
                                                        {row.sku} — {row.qty} (Billing: {row.billing_amount})
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            formatValue(value, key)
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>

                    {/* 🎯 FOOTER SECTION */}
                    <div className="modal-footer">
                        {type === 'Cover PWP' ? (
                            // 👉 If Cover PWP — show only main budget
                            <div className="footer-card red">
                                <span className="footer-label">💸 Budget</span>
                                <span className="footer-value">
                                    ₱ {Number(data.amount_badget || 0).toLocaleString()}
                                </span>
                            </div>
                        ) : (
                            // 👉 If Regular or others — show remaining & used
                            <>
                                <div className="footer-card green">
                                    <span className="footer-label">💼 Remaining Budget</span>
                                    <span className="footer-value">
                                        ₱ {Number(data.remaining_balance || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="footer-card red">
                                    <span className="footer-label">💸 Used Budget</span>
                                    <span className="footer-value">
                                        ₱ {Number(data.credit_budget || 0).toLocaleString()}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>




                    <div className="bottom-text-section">
                        <div className="text-block">
                            <label>{formatFieldName('objective')}</label>
                            <div className="big-text-box">{data.objective || '-'}</div>
                        </div>
                        <div className="text-block">
                            <label>{formatFieldName('promo_scheme')}</label>
                            <div className="big-text-box">{data.promo_scheme || '-'}</div>
                        </div>
                        <div className="text-block" style={{ width: '100%' }}>
                            <label>{formatFieldName('remarks')}</label>
                            <div className="big-text-box">{data.remarks || '-'}</div>
                        </div>

                    </div>
                </div>
                {skuListing.length === 0 && accountsBudgetList.length > 0 && (
                    <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <h4 style={{ color: '#2575fc', marginBottom: '0.5rem' }}>Accounts Budget</h4>

                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                minWidth: '500px', // ensure horizontal scroll on small screens
                                boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#2575fc', color: '#ffffff', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>Account Code</th>
                                    <th style={{ padding: '10px' }}>Account Name</th>
                                    <th style={{ padding: '10px' }}>Budget</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accountsBudgetList.map((row) => (
                                    <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                                        <td style={{ padding: '8px' }}>{row.account_code}</td>
                                        <td style={{ padding: '8px' }}>{row.account_name}</td>
                                        <td style={{ padding: '8px' }}>{Number(row.budget).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {/* Total Row */}
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5fb' }}>
                                    <td style={{ padding: '10px' }} colSpan="2">Total</td>
                                    <td style={{ padding: '10px' }}>
                                        {accountsBudgetList
                                            .reduce((acc, row) => acc + parseFloat(row.budget || 0), 0)
                                            .toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                )}

                {skuListing.length > 0 && (
                    <div className="table-wrapper" style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <h4 style={{ color: '#2575fc', marginBottom: '0.5rem' }}>SKU Listing</h4>

                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                minWidth: '600px', // for responsiveness with horizontal scroll
                                boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            <thead>
                                <tr style={{ backgroundColor: '#2575fc', color: '#ffffff', textAlign: 'left' }}>
                                    <th style={{ padding: '10px' }}>SKU</th>
                                    <th style={{ padding: '10px' }}>SRP</th>
                                    <th style={{ padding: '10px' }}>Qty</th>
                                    <th style={{ padding: '10px' }}>UOM</th>
                                    <th style={{ padding: '10px' }}>Discount</th>
                                    <th style={{ padding: '10px' }}>Billing Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {skuListing
                                    .filter(row => row.sku !== 'Total:' && row.sku !== 'Total')
                                    .map((row) => (
                                        <tr key={row.id} style={{ borderBottom: '1px solid #ddd' }}>
                                            <td style={{ padding: '8px' }}>{row.sku || '-'}</td>
                                            <td style={{ padding: '8px' }}>
                                                {row.srp != null ? Number(row.srp).toLocaleString() : '-'}
                                            </td>
                                            <td style={{ padding: '8px' }}>{row.qty ?? '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.uom || '-'}</td>
                                            <td style={{ padding: '8px' }}>
                                                {row.discount != null ? `${row.discount}%` : '-'}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {row.billing_amount != null
                                                    ? Number(row.billing_amount).toLocaleString()
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                {/* Total Row */}
                                <tr style={{ fontWeight: 'bold', backgroundColor: '#f1f5fb' }}>
                                    <td style={{ padding: '10px' }} colSpan="5">Total</td>
                                    <td style={{ padding: '10px' }}>
                                        {skuListing
                                            .filter(row => row.sku !== 'Total:' && row.sku !== 'Total')
                                            .reduce((acc, row) => acc + (parseFloat(row.billing_amount) || 0), 0)
                                            .toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                )}




                <div className="modal-footer">
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 22px',
                            fontSize: '16px',
                            fontWeight: '600',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 3px 6px rgba(0, 123, 255, 0.4)',
                            transition: 'background-color 0.3s ease, box-shadow 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                            e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 86, 179, 0.6)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#007bff';
                            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 123, 255, 0.4)';
                        }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.backgroundColor = '#004494';
                            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 68, 148, 0.8)';
                        }}
                        onMouseUp={(e) => {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                            e.currentTarget.style.boxShadow = '0 5px 12px rgba(0, 86, 179, 0.6)';
                        }}
                    >
                        Close
                    </button>
                </div>
            </div >
        </div >
    );
};

export default ViewDataModal;
