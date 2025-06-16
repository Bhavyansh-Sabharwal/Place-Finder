document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');
    const downloadSection = document.getElementById('downloadSection');
    const downloadLink = document.getElementById('downloadLink');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Hide previous results and errors
        resultsDiv.classList.add('hidden');
        errorDiv.classList.add('hidden');
        downloadSection.classList.add('hidden');
        
        // Show loading spinner
        loadingDiv.classList.remove('hidden');
        
        const formData = {
            address: document.getElementById('address').value,
            distance: document.getElementById('distance').value,
            place_type: document.getElementById('place_type').value
        };

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Show results
                resultsDiv.classList.remove('hidden');
                resultsContent.innerHTML = `
                    <div class="p-4 bg-green-50 rounded-md">
                        <p class="text-green-700">${data.message}</p>
                    </div>
                `;
                
                // Show download button
                downloadSection.classList.remove('hidden');
                downloadLink.href = `/download/${data.output_file}`;
            } else {
                throw new Error(data.message || 'An error occurred');
            }
        } catch (error) {
            errorDiv.classList.remove('hidden');
            errorMessage.textContent = error.message;
        } finally {
            loadingDiv.classList.add('hidden');
        }
    });
}); 