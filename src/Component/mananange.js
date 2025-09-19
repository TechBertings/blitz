import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";

function EnhancedDatabaseInterface() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [columns, setColumns] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState("all"); // all | cover | regular

  // Define the specific columns to show for each table (moved outside component or use useMemo)
  const REGULAR_COLUMNS = useMemo(() => ['id', 'regularpwpcode', 'accountType', 'pwptype', 'created_at', 'createForm'], []);
  const COVER_COLUMNS = useMemo(() => ['id', 'cover_code', 'account_type', 'pwp_type', 'created_at', 'createForm'], []);

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

  // ✅ fetchData is stable because of useCallback with proper dependencies
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
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
        }));
      }

      const mergedData = [...coverData, ...regularData];

      if (mergedData.length > 0) {
        // Create unified column set - use all possible columns from both tables
        const regularCols = REGULAR_COLUMNS.filter(col => col !== 'regularpwpcode');
        const coverCols = COVER_COLUMNS.filter(col => col !== 'covercode');
        
        // Create unified columns with code column as the second column
        if (filter === "all") {
          allColumns = ['id', 'code', ...regularCols.slice(1)]; // Skip id since it's already first
        } else if (filter === "cover") {
          allColumns = ['id', 'covercode', ...coverCols.slice(1)];
        } else if (filter === "regular") {
          allColumns = ['id', 'regularpwpcode', ...regularCols.slice(1)];
        }
        
        // Normalize the data to have a unified 'code' column when showing all
        const normalizedData = mergedData.map(item => {
          if (filter === "all") {
            return {
              ...item,
              code: item.regularpwpcode || item.covercode || '-'
            };
          }
          return item;
        });

        setColumns(allColumns);
        setData(normalizedData);
      } else {
        setError("No data found in tables");
        setData([]);
      }
    } catch (err) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter, REGULAR_COLUMNS, COVER_COLUMNS]);

  const handleEdit = (row) => {
    setEditingId(row.id);
    setEditingData({ ...row });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setUpdating(true);

    try {
      const table = editingData.source;
      
      // Prepare the update data by removing UI-specific fields
      const updateData = { ...editingData };
      delete updateData.source;
      
      // Handle the code field mapping back to original column names
      if (filter === "all" && updateData.code) {
        if (table === "regular_pwp") {
          updateData.regularpwpcode = updateData.code;
        } else if (table === "cover_pwp") {
          updateData.covercode = updateData.code;
        }
        delete updateData.code;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", editingId);

      if (updateError) {
        setError(`Update Error: ${updateError.message}`);
      } else {
        setEditingId(null);
        setEditingData({});
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
            <h3 style={{ margin: '0 0 10px', color: '#c62828' }}>Database Error</h3>
            <p style={{ margin: 0, color: '#d32f2f' }}>{error}</p>
          </div>
          <button 
            onClick={fetchData}
            style={{
              padding: '12px 24px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Retry Connection
          </button>
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
          backgroundColor: '#1976d2',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px', fontSize: '24px' }}>PWP Database Management</h1>
              <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                {data.length} records found {filter !== 'all' && `(${filter} only)`}
              </p>
            </div>

            {/* Right controls: Filter + Refresh */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Filter Dropdown */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  fontSize: '14px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
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
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
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
                  width: '150px'
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
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEdit(row)}
                          disabled={updating}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            opacity: updating ? 0.7 : 1
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(row.id)}
                          disabled={updating}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: updating ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
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