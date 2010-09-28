/*
 * jQuery UI AddressLookup 1.0
 *
 * Copyright 2010, Matthijs Groen
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * Depends:
 *   jquery.ui.core.js
 *   jquery.ui.widget.js
 *   http://maps.google.com/maps/api/js?v=3.1&sensor=false
 */
(function($, undefined) {

    $.widget("ui.addressLookup", {
        options: {
            fields: {
                postal_code: '.postal_code:input',
                street_number: '.street_number:input',
                street: '.street:input',
                city: '.city:input',
                municipality: '.municipality:input',
                province: '.province:input',
                country: '.country:input',
                latitude: '.latitude:input',
                longitude: '.longitude:input'
            },
            map: {
                zoom: 15,
                type: google.maps.MapTypeId.ROADMAP,
                center: new google.maps.LatLng(50.049813,2.708296),
                selector: '.address_map',
                width: 100,
                height: 100
            }
        },
        field_values: {
            postal_code: "",
            street_number: "",
            street: "",
            city: "",
            municipality: "",
            province: "",
            country: "",
            latitude: "",
            longitude: ""
        },
        marker: null,
        suggested_streets: [],
        _create: function() {
            this.geocoder = new google.maps.Geocoder();
            this._setupMap(this.options.map);

            this.suggested_streets = [];
            this.request_feedback = 0;

            $(this.options.fields.postal_code, this.element).bind('blur', this, this._doBlur);
            $(this.options.fields.street_number, this.element).bind('blur', this, this._doBlur);
        },
        destroy: function() {
            $(this.options.fields.postal_code, this.element).unbind('blur', this._doBlur);
            $(this.options.fields.street_number, this.element).unbind('blur', this._doBlur);
            $.Widget.prototype.destroy.apply(this, arguments);
        },
        _doBlur: function(event) {
            event.data.lookupAddressByFields();
        },
        lookupAddressByFields: function() {
            var postal_code = $(this.options.fields.postal_code, this.element).val();
            var street_number = $(this.options.fields.street_number, this.element).val();

            if (((postal_code != this.field_values.postal_code) || (street_number != this.field_values.street_number)) &&
                    (postal_code != "") && (street_number != "")) {
                this._clearValues();
                this.field_values.postal_code = postal_code;
                this.field_values.street_number = street_number;
                this._lookupAddress(postal_code);
            }

        },
        _lookupAddress: function(query) {
            var self = this;
            this.geocoder.geocode({ 'address': query, 'region': 'nl' }, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    self._searchStreetsInArea(results[0].geometry.location);
                } else {
                    alert("Geocode was not successful for the following reason: " + status);
                }
            });
        },
        _searchStreetsInArea: function(location) {
            var longCorrection = 0.0006;
            var latCorrection = 0.0006;
            var self = this;

            this.request_feedback = 0;
            this.suggested_streets = [];
            this.temp_location = location;
            var try_locations = [];
            try_locations.push(new google.maps.LatLng(location.lat(), location.lng()));
            try_locations.push(new google.maps.LatLng(location.lat() + latCorrection, location.lng() + longCorrection));
            try_locations.push(new google.maps.LatLng(location.lat() + latCorrection, location.lng() - longCorrection));
            try_locations.push(new google.maps.LatLng(location.lat() - latCorrection, location.lng() + longCorrection));
            try_locations.push(new google.maps.LatLng(location.lat() - latCorrection, location.lng() - longCorrection));

            for (var index in try_locations) {
                this.geocoder.geocode({ 'latLng': try_locations[index] }, function(results, status) {
                    var suggest = [];
                    if (status == google.maps.GeocoderStatus.OK) {
                        var comp = results[0].address_components;
                        for (var i in comp) {
                            if ($.inArray("route", comp[i].types) >= 0) suggest.push(comp[i].long_name);
                        }
                        self._fillFieldValues(comp);
                        self.field_values.street = "";
                    } else {
                        alert(status);
                    }
                    alert(suggest);
                    self._addPotentialStreetNames(suggest, location);
                });
            }
        },
        _addPotentialStreetNames: function(street_names, location) {
            if (street_names.length > 0)
                for (var index in street_names)
                    if ($.inArray(street_names[index], this.suggested_streets) == -1)
                        this.suggested_streets.push(street_names[index]);
            this.request_feedback ++;
            if (this.request_feedback == 5) // All feedback collected
                if (this.suggested_streets.length == 1) {
                    this.field_values.street = this.suggested_streets[0];
                    this._setLocation(this.temp_location);
                    this._setValues();
                } else this._verifyStreet(this.suggested_streets);
        },
        _verifyStreet: function(streetList) {
            var match_postal_code = this.field_values.postal_code.split(' ').join('').toUpperCase();
            var self = this;
            var verified = false;
            for (var index in streetList) {
                var query = streetList[index] + " " + this.field_values.street_number + ", " +
                        this.field_values.postal_code + ", " + this.field_values.city;
                this.geocoder.geocode({ 'address': query, 'region': 'nl' }, function(results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        var comp = results[0].address_components;
                        for (var i in comp) {
                            if ($.inArray("postal_code", comp[i].types) >= 0) {
                                var compare_postal_code = comp[i].long_name.split(' ').join('').toUpperCase();
                                if (compare_postal_code == match_postal_code) {
                                    self._setLocation(results[0].geometry.location);
                                    self._fillFieldValues(comp);
                                    self._setValues();
                                    verified = true;
                                }
                            }
                        }
                    } else {
                        alert("Geocode was not successful for the following reason: " + status);
                    }
                });
            }
            if (!verified) {
              self._setValues();
            }
        },
        _setValues: function() {
            $(this.options.fields.street, this.element).val(this.field_values.street);
            $(this.options.fields.city, this.element).val(this.field_values.city);
            $(this.options.fields.municipality, this.element).val(this.field_values.municipality);
            $(this.options.fields.province, this.element).val(this.field_values.province);
            $(this.options.fields.country, this.element).val(this.field_values.country);
            $(this.options.fields.latitude, this.element).val(this.field_values.latitude);
            $(this.options.fields.longitude, this.element).val(this.field_values.longitude);
        },
        _fillFieldValues: function(fields) {
            for (var i in fields) {
                if ($.inArray("route", fields[i].types) >= 0) this.field_values.street = fields[i].long_name;
                if ($.inArray("sublocality", fields[i].types) >= 0) this.field_values.city = fields[i].long_name;
                if ($.inArray("locality", fields[i].types) >= 0) this.field_values.municipality = fields[i].long_name;
                if ($.inArray("administrative_area_level_1", fields[i].types) >= 0) this.field_values.province = fields[i].long_name;
                if ($.inArray("country", fields[i].types) >= 0) this.field_values.country = fields[i].long_name;
            }
        },
        _setOption: function(key, value) {
            $.Widget.prototype._setOption.apply(this, arguments);
        },
        _setupMap: function(settings) {
            this.myOptions = {
                zoom: settings.zoom,
                center: settings.center,
                mapTypeId: settings.type,
                disableDefaultUI: true
            }
            // setup the map canvas element
            var mapCanvas = $(settings.selector, this.element);
            if (mapCanvas.length == 0) {
                this.options.map.selector = ".address_map";
                this.element.append("<div class=\"address_map\"></div>");
                mapCanvas = $(this.options.map.selector, this.element);
            }
            var height = Math.max(settings.height, 100);
            var width = Math.max(settings.width, 100);
            mapCanvas.css({ width: width, height: height });

            this.map = new google.maps.Map(mapCanvas[0], this.myOptions);
        },
        _setLocation: function(location) {
            this.field_values.latitude = location.lat();
            this.field_values.longitude = location.lng();
            if (this.marker != null) this.marker.setMap(null);
            this.marker = null;
            this.marker = new google.maps.Marker({
                map: this.map,
                position: location
            });
            this.map.setCenter(location);
        },
        _clearValues: function() {
            this.field_values.postal_code = "";
            this.field_values.street_number = "";
            this.field_values.street = "";
            this.field_values.city = "";
            this.field_values.municipality = "";
            this.field_values.province = "";
            this.field_values.country = "";
            this.field_values.latitude = "";
            this.field_values.longitude = "";
        }

    });

    $.extend($.ui.addressLookup, {
        version: "1.0"
    });

})(jQuery);
