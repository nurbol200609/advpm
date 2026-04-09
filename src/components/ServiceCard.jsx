function ServiceCard({ title, onClick }) {
  return (
    <div style={{
      border: '1px solid gray',
      padding: '20px',
      margin: '10px',
      width: '200px',
      borderRadius: 8,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    }}>
      <h3>{title}</h3>
      <button onClick={onClick} style={{ marginTop: 10, padding: '8px 12px', cursor: 'pointer' }}>
        Open
      </button>
    </div>
  )
}

export default ServiceCard;