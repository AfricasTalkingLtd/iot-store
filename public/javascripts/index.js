/* eslint-disable */
(function () {
    $('#reference').val('PREMIUM_ELECTRONICS_' + Math.floor((Math.random() * 78346) + 1));

    $('#cart').on('click', () => {
        $("#payment-cart").hide();
        $("#shopping-cart").fadeToggle( "fast");
    });

    $('#btnCheckout').click(() => {
        $("#shopping-cart").slideToggle( "fast", function(){
            $("#payment-cart").slideToggle("fast");
        });
    });

    $('#btnPay').click(function (e) {
        if ($(this).hasClass('disabled')) {
            return;
        }

        if ($(this).html() === 'OK') {
            location.reload();
            return;
        }

        $(this).addClass('disabled');
        $(this).html('Please wait...');
        $('#payment-form').submit();

        e.preventDefault();
    });

    $('#payment-form').submit((event) => {

        var formData = {};

        var txn = $("#transaction").val();
        var code = $("#confirmation-code").val();

        var action = (txn !== "") ? "confirm" : "request";
        if(action === "confirm") {
            formData = {
                'transaction' : txn,
                'code': code
            };
        } else { // is request
            formData = {
                'phone' : '254' + $("#phone").val(),
                'amount': $("#amount").val(),
                'currency': 'KES',
                'reference': $("#reference").val()
            };
        }

        $.ajax({
            type: 'POST',
            url: '/checkout/' + action,
            data : formData
        }).done(function(data) {

            $("#btnPay").removeClass("disabled");

            if(action === "request") {
                // If no error
                $("#btnPay").html("Confirm");
                $("#confirmation-code").show();

                $("#transaction").val(data.transaction);

                $("#phoneNumberInput").fadeToggle("fast", function() {
                    $("#mpesaMsg").html(data.message); // HUH
                });


            } else {
                // If no error, thank you
                $("#mpesaMsg").html(data.message);
                $("#btnPay").html("OK");
                $("#confirmation-code").hide();
            }

        }).error(function(err) {

            var data = err.responseJSON;

            $("#phoneNumberInput").fadeToggle("fast", function() {
                $("#btnPay").removeClass("disabled");
                $("#mpesaMsg").html(data.description || data.error || data.message || "Oops :(");
                $("#btnPay").html("OK");
                $("#confirmation-code").hide();
            });


        });

        // stop the form from submitting the normal way and refreshing the page
        event.preventDefault();
    });
}());
