import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import EditModal from "./EditModal";


function EnhancedDatabaseInterface() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
const [setEditRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState("all"); // all | cover | regular
  const [statusFilter, setStatusFilter] = useState("all"); // all | approved | declined | sent_back | cancelled
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
const [selectedRow, setSelectedRow] = useState(null);
const [isModalOpen, setIsModalOpen] = useState(false);


  // Define the specific columns to show for each table (moved outside component or use useMemo)
  const COVER_COLUMNS = useMemo(() => ['id', 'cover_code', 'account_type', 'pwp_type', 'created_at', 'createForm'], []);
  const REGULAR_COLUMNS = useMemo(() => ['id', 'regularpwpcode', 'accountType', 'pwptype', 'created_at', 'createForm'], []);
 

  // Function to filter object keys based on allowed columns
  const filterColumns = (obj, allowedColumns) => {
    const filtered = {};
    allowedColumns.forEach(col => {
      if (obj.hasOwnProperty(col)) {
        filtered[col] = obj[col];
      }
    });
    return filtered;
  };
// Function to get approval status for PWP codes
const getApprovalStatus = async (pwpCodes) => {
  try {
    const { data: approvalData, error } = await supabase
      .from("Approval_History")
      .select("PwpCode, Response, DateResponded, created_at")
      .in("PwpCode", pwpCodes);

    if (error) {
      console.error("Error fetching approval status:", error);
      return {};
    }

    // Create a map of PWPCode to approval status
    const approvalMap = {};
    approvalData?.forEach(approval => {
      approvalMap[approval.PwpCode] = {
        status: approval.Response || 'Pending',
        date_responded: approval.DateResponded,
        approval_created: approval.created_at
      };
    });

    return approvalMap;
  } catch (err) {
    console.error("Unexpected error fetching approval status:", err);
    return {};
  }
};

  // Modified fetchData function - replace your existing fetchData with this
const fetchData = useCallback(async () => {
  try {
    setLoading(false);
    setError(null);

    let coverData = [];
    let regularData = [];
    let allColumns = [];

    if (filter === "all" || filter === "cover") {
      const { data: cData, error: cError } = await supabase
        .from("cover_pwp")
        .select(COVER_COLUMNS.join(','))
        .order("id", { ascending: false })
        .limit(50);

      if (cError) throw cError;
      coverData = (cData || []).map((item) => ({
        ...filterColumns(item, COVER_COLUMNS),
        source: "cover_pwp",
        pwp_code: item.cover_code // Use this to match with Approval_History
      }));
    }

    if (filter === "all" || filter === "regular") {
      const { data: rData, error: rError } = await supabase
        .from("regular_pwp")
        .select(REGULAR_COLUMNS.join(','))
        .order("id", { ascending: false })
        .limit(50);

      if (rError) throw rError;
      regularData = (rData || []).map((item) => ({
        ...filterColumns(item, REGULAR_COLUMNS),
        source: "regular_pwp",
        pwp_code: item.regularpwpcode // Use this to match with Approval_History
      }));
    }

    const mergedData = [...coverData, ...regularData];
    
    // Get all PWP codes to fetch approval status
    const allPwpCodes = mergedData
      .map(item => item.pwp_code)
      .filter(code => code); // Remove null/undefined codes

    // Fetch approval status for all PWP codes
    const approvalStatusMap = await getApprovalStatus(allPwpCodes);

    // Add approval status to each item
    const dataWithApprovalStatus = mergedData.map(item => ({
      ...item,
      approval_status: approvalStatusMap[item.pwp_code]?.status || 'Pending',
      date_responded: approvalStatusMap[item.pwp_code]?.date_responded,
      approval_created: approvalStatusMap[item.pwp_code]?.approval_created
    }));

    // Apply filters
    let filteredData = dataWithApprovalStatus;


// Apply search filter
if (searchQuery) {
  filteredData = filteredData.filter(item => {
    const searchFields = [
      item.code,                   // for "all" filter
      item.cover_code,             // for cover records
      item.regularpwpcode,        // for regular records
      item.id,        
      item.account_type,
      item.accountType,
      item.pwp_type,
      item.pwptype,
      item.createForm
    ];

    return searchFields.some(field =>
      field && field.toString().toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
}

     
    // Apply status filter based on approval status
    if (statusFilter !== "all") {
      filteredData = filteredData.filter(item => {
        const itemStatus = item.approval_status ? item.approval_status.toLowerCase() : 'pending';
        if (statusFilter === "sent_back") {
          return itemStatus === "sent back for revision" || itemStatus === "sent back";
        }
        if (statusFilter === "cancelled") {
          return itemStatus === "cancelled";
        }
        if (statusFilter === "pending") {
          return itemStatus === "pending" || !item.approval_status;
        }
        if (statusFilter === "approved") {
          return itemStatus === "approved";
        }
        if (statusFilter === "declined") {
          return itemStatus === "declined";
        }
        return itemStatus === statusFilter;
      });
    }

    // Apply date filters
    if (dateFrom) {
      filteredData = filteredData.filter(item => {
        if (!item.created_at) return false;
        const itemDate = new Date(item.created_at);
        const fromDate = new Date(dateFrom);
        return itemDate >= fromDate;
      });
    }

    if (dateTo) {
      filteredData = filteredData.filter(item => {
        if (!item.created_at) return false;
        const itemDate = new Date(item.created_at);
        const toDate = new Date(dateTo);
        return itemDate <= toDate;
      });
    }

    if (filteredData.length > 0) {
      // Create unified column set
      const regularCols = REGULAR_COLUMNS.filter(col => col !== 'regularpwpcode');
      const coverCols = COVER_COLUMNS.filter(col => col !== 'cover_code');
      
      // Create unified columns with code column as the second column
      if (filter === "all") {
        allColumns = ['id', 'code', ...regularCols.slice(1)]; // Skip id since it's already first
      } else if (filter === "cover") {
        allColumns = ['id', 'cover_code', ...coverCols.slice(1)];
      } else if (filter === "regular") {
        allColumns = ['id', 'regularpwpcode', ...regularCols.slice(1)];
      }
      
      // Normalize the data to have a unified 'code' column when showing all
      const normalizedData = filteredData.map(item => {
        if (filter === "all") {
          return {
            ...item,
            code: item.regularpwpcode || item.cover_code || '-',
            accountType: item.accountType || item.account_type || '-',
            pwptype: item.pwptype || item.pwp_type || '-'
          };
        }
        return item;
      });

      setColumns(allColumns);
      setData(normalizedData);
    } else {
      setData([]);
      setColumns([]);
    }
  } catch (err) {
    setError(`Unexpected error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}, [filter, REGULAR_COLUMNS, COVER_COLUMNS, statusFilter, searchQuery, dateFrom, dateTo]);

const handleEdit = async (row) => {
  // Determine kung cover_pwp o regular_pwp
  const tableName = row.source === "cover" ? "cover_pwp" : "regular_pwp";

  // Fetch full record with all fields
  const { data, error } = await supabase
    .from(tableName)
    .select("*") // lahat ng columns
    .eq("id", row.id)
    .single();

  if (error) {
    console.error("Error fetching full record:", error);
    return;
  }

  // Pass full record to modal
  setSelectedRow({
    ...data,
    source: row.source, // keep track kung cover or regular
  });

  setIsModalOpen(true);
};

const handleSave = async (updatedData) => {
  setUpdating(true);
  try {
    const table = updatedData.source;
    const updateData = { ...updatedData };
    delete updateData.source;

    // Handle code mapping
    if (filter === "all" && updateData.code) {
      if (table === "regular_pwp") {
        updateData.regularpwpcode = updateData.code;
      } else if (table === "cover_pwp") {
        updateData.cover_code = updateData.code;
      }
      delete updateData.code;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq("id", updatedData.id);

    if (updateError) {
      setError(`Update Error: ${updateError.message}`);
    } else {
      setEditRow(null);
      await fetchData();
    }
  } catch (err) {
    setError(`Unexpected error: ${err.message}`);
  } finally {
    setUpdating(false);
  }
};


  const handleCancel = () => {
    setEditingId(null);
    setEditingData({});
  };


  const handleDelete = async (rowId) => {
    setUpdating(true);
    try {
      // Find the row to get its source
      const row = data.find(r => r.id === rowId);
      if (!row) {
        setError("Row not found");
        return;
      }

      const table = row.source;
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", rowId);

      if (deleteError) {
        setError(`Delete Error: ${deleteError.message}`);
      } else {
        setDeleteConfirm(null);
        await fetchData();
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Updated getStatusBadge function - replace your existing one
const getStatusBadge = (status) => {
  const statusLower = status ? status.toLowerCase() : 'pending';
  let bgColor, textColor, borderColor;

  switch (statusLower) {
    case 'approved':
      bgColor = '#e8f5e8';
      textColor = '#2e7d32';
      borderColor = '#c8e6c9';
      break;
    case 'declined':
      bgColor = '#ffebee';
      textColor = '#c62828';
      borderColor = '#ffcdd2';
      break;
    case 'sent back for revision':
    case 'sent back':
      bgColor = '#fff3e0';
      textColor = '#e65100';
      borderColor = '#ffcc02';
      break;
    case 'cancelled':
      bgColor = '#f3e5f5';
      textColor = '#7b1fa2';
      borderColor = '#e1bee7';
      break;
    case 'pending':
    default:
      bgColor = '#fff3cd';
      textColor = '#8a6d3b';
      borderColor = '#ffeaa7';
  }

  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: '16px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        textTransform: 'capitalize',
        letterSpacing: '0.5px',
      }}
    >
      {status || 'Pending'}
    </span>
  );
};

  const formatColumnName = (colName) => {
    return colName
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Pwp', 'PWP')
      .replace('Id', 'ID');
  };

  const formatCellValue = (value, colName) => {
    if (!value && value !== 0) return '-';
    
    // Format dates
    if (colName === 'createdat' && value) {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    
    return String(value);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '20px 40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e3f2fd',
            borderTop: '4px solid #1976d2',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <h2 style={{ margin: 0, color: '#333' }}>Loading Database...</h2>
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px',
        backgroundColor: '#f8f9fa',
        minHeight: '100vh'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            backgroundColor: '#ffebee',
            border: '1px solid #ef5350',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <p style={{ margin: 0, color: '#d32f2f' }}>{error}</p>
          </div>
        
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 30px',
          backgroundColor: '#2575fc',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '24px', color: 'white' }}>PWP Database Management</h1>              
          <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                {data.length} records found {filter !== 'all' && `(${filter} only)`}
              </p>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Search Input */}
              <input
                type="text"
                placeholder="Search records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                  color: 'white',
                  minWidth: '200px'
                }}
              />

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
                <option value="sent_back">Sent Back</option>
                <option value="cancelled">Cancelled</option>
                <option value="cancelled">Pending</option>
              </select>

              {/* Date From */}
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From Date"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                }}
              />

              {/* Date To */}
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To Date"
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                }}
              />
              {/* Filter Dropdown */}
              
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Records</option>
                <option value="cover">Cover PWP Only</option>
                <option value="regular">Regular PWP Only</option>
              </select>

              {/* Refresh Button */}
              <button 
                onClick={fetchData}
                disabled={updating}
                style={{
                  padding: '8px 16px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: updating ? 0.7 : 1
                }}
              >
                {updating ? 'Updating...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#fafafa' }}>
                {columns.map(col => (
                  <th key={col} style={{ 
                    padding: '16px 20px', 
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#333',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {formatColumnName(col)}
                  </th>
                ))}
                                <th style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: '2px solid #e0e0e0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '200px'
                }}>
                  Status
                </th>
                <th style={{ 
                  padding: '16px 20px', 
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#333',
                  fontSize: '14px',
                  borderBottom: '2px solid #e0e0e0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '250px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={row.id || index} style={{
                  backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                  transition: 'background-color 0.2s ease'
                }}>
                  {columns.map(col => (
                    <td key={col} style={{ 
                      padding: '16px 20px', 
                      borderBottom: '1px solid #e0e0e0',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {editingId === row.id && col !== 'id' && col !== 'createdat' ? (
                        <input
                          type="text"
                          value={editingData[col] || ''}
                          onChange={(e) => setEditingData({...editingData, [col]: e.target.value})}
                          style={{
                            padding: '6px 10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                            width: '100%',
                            minWidth: '120px'
                          }}
                        />
                      ) : (
                        <span style={{ 
                          maxWidth: col === 'createdat' ? '150px' : '200px',
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatCellValue(row[col], col)}
                        </span>
                      )}
                    </td>
                  ))}
                  <td style={{ 
                    padding: '16px 20px', 
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }}>
                  {getStatusBadge(row.approval_status)}
                  </td>
                  <td style={{ 
                    padding: '16px 20px', 
                    borderBottom: '1px solid #e0e0e0',
                    textAlign: 'center'
                  }}>
                    {editingId === row.id ? (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={handleSave}
                          disabled={updating}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: updating ? 0.7 : 1
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={updating}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#757575',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: updating ? 0.7 : 1
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                
          {/* Edit and Delete Buttons */}
                      <button
                        onClick={() => handleEdit(row)}
                        disabled={updating}
                        style={{
                          padding: "10px 10px",
                          backgroundColor: "#2196f3",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: updating ? "not-allowed" : "pointer",
                          fontSize: "10px",
                          fontWeight: "500",
                          opacity: updating ? 0.7 : 1
                            }}
>
                        Edit
                         </button>
                        <button
                          onClick={() => setDeleteConfirm(row.id)}
                          disabled={updating}
                          style={{
                            padding: '10px 10px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            fontSize: '10px',
                            fontWeight: '500',
                            opacity: updating ? 0.7 : 1
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

            <EditModal
  isOpen={isModalOpen}
  rowData={selectedRow}
  onClose={() => setIsModalOpen(false)}
  onSave={handleSave}
  updating={updating}
/>
{/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 15px', color: '#333' }}>Confirm Delete</h3>
            <p style={{ margin: '0 0 20px', color: '#666' }}>
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={updating}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#757575',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={updating}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: updating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  opacity: updating ? 0.7 : 1
                }}
              >
                {updating ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedDatabaseInterface;