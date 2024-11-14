// Example starter JavaScript for disabling form submissions if there are invalid fields
(() => {

    'use strict'

    // Fetch all the forms we want to apply custom Bootstrap validation styles to
    const forms = document.querySelectorAll('.needs-validation')
    // Loop over them and prevent submission
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            else
            {
                //document.querySelector(".modal-container").classList.remove("d-none");
                document.getElementById('submitbutton').disabled = true;
                document.getElementById('submitbutton').style.opacity='0.5';
                //document.querySelector(".modal-container").classList.remove("d-none");
            }

            form.classList.add('was-validated')
        }, false)
    });

})()
