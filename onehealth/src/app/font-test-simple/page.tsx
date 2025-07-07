export default function SimpleFontTest() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>Font Test - Headers should use Poppins</h1>
      <h2>This is an H2 header</h2>
      <h3>This is an H3 header</h3>
      
      <p>This is body text that should use Montserrat font family.</p>
      <p>Another paragraph to test the body font.</p>
      
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f0f0f0' }}>
        <h4>Font Inspector</h4>
        <p>Open browser developer tools and inspect the elements above.</p>
        <p>Headers (h1, h2, h3, h4) should show font-family: Poppins</p>
        <p>Paragraphs should show font-family: Montserrat</p>
      </div>
    </div>
  )
}