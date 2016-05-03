'use strict';
//TODO: dodelat cache na dotazy identifikatoru v bbox...posila se nyni znytecne


goog.provide('ol.Overlay.FeaturePopup');
goog.require('ol.source.Vector');
goog.require('ol.Overlay');




ol.Overlay.FeaturePopup = function(opt_options) {
    var this_ = this;
    
    /*
    this.popup = document.createElement('div');
    this.popup.className = 'w-popup-wrapper';

    this.container = document.createElement('div'); // document.createElement('div');
    this.container.className = 'w-panel ol-feature-popup ';

    this.header = document.createElement('div');
    this.header.className = 'ol-feature-popup-header w-list-menu bg-color-layer';

    this.headerLabel = document.createElement('p');
    this.headerLabel.className = 'nav navbar-text';
    this.header.appendChild(this.headerLabel);


    this.closeButton = document.createElement('div');
    this.closeButton.className = 'w-close';
    this.header.appendChild(this.closeButton);

    this.container.appendChild(this.header);

    this.content = document.createElement('div');
    this.content.className = 'ol-feature-popup-content';
    this.container.appendChild(this.content);

    this.popup.appendChild(this.container);
    var arrow = document.createElement('div');
    arrow.className = 'arrow-triangle-down';*/
    
    /*    
    <div class="ol-popup">   
        <div class="header">
            <h1>Vrstva: obce</h1>
        </div>

        <ul class="property-list">
            <li class="property-item">
                <div class="property-label">kod: </div>
                <div class="property-value">584762</div>
            </li>

            <li class="property-item">
                <div class="property-label">nazev: </div>
                <div class="property-value">Pasohlávky</div>
            </li>

            <li class="property-item">
                <div class="property-label">okreskod: </div>
                <div class="property-value">3703</div>
            </li>

            <li class="property-item">
                <div class="property-label">nutslau: </div>
                <div class="property-value">CZ0643584762</div>
            </li>
        </ul>
    </div>
    */
    

    this.popup = document.createElement('div');
    this.popup.className = 'ol-popup ';

    this.container = document.createElement('div'); // document.createElement('div');
    this.container.className = 'ol-popup-content ol-feature-popup';

    this.header = document.createElement('div');
    this.header.className = 'ol-popup-header header';

    this.headerLabel = document.createElement('p');
    this.headerLabel.className = 'ol-header-text';
    this.header.appendChild(this.headerLabel);


    this.closeButton = document.createElement('div');
    this.closeButton.className = 'ol-popup-close';
    this.closeButton.innerHTML = '<a href=""><i class="fa fa-times" aria-hidden="true"></i></a>';
    
    this.header.appendChild(this.closeButton);

    this.container.appendChild(this.header);

    this.content = document.createElement('div');
    this.container.appendChild(this.content);
    
    this.popup.appendChild(this.container);

    this.closeButton.addEventListener('click', function(evt) {
        this_.hide();
        evt.preventDefault();
    }, false);

    ol.Overlay.call(this, {
        element: this.popup,
        stopEvent: true
    });
};


ol.inherits(ol.Overlay.FeaturePopup, ol.Overlay);

ol.Overlay.FeaturePopup.prototype.show = function(coord, html) {
    this.setPosition(coord);
    this.content.innerHTML = html;
    this.popup.style.display = 'block';
    this.content.scrollTop = 0;

    this.centerPopup();
    return this;
};

ol.Overlay.FeaturePopup.prototype.hide = function(coord, html) {
    this.popup.style.display = 'none';
    return this;
};

ol.Overlay.FeaturePopup.prototype.centerPopup = function() {
    var marginTop = '-' + (parseInt(this.container.clientHeight, 10) + 15) + 'px';
    var marginLeft = '-' + (parseInt(this.container.clientWidth, 10) / 2) + 'px';
    this.container.style['margin-top']  = marginTop;
    this.container.style['margin-left'] = marginLeft;
};


//TODO: popup can be after opening behind client screen
ol.Overlay.FeaturePopup.prototype.panMapOnPopup = function() {
    //map.getView().setCenter(map.getCoordinateFromPixel(evt.pixel));
};

