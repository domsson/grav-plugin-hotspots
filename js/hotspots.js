function Hotspots(o)
{
	// settings
	this.attr        = this.get_opt(o, "attribute", "data-hotspots");
	this.name        = this.get_opt(o, "name", null);
	this.area_active = this.get_opt(o, "area_active", "active");
	this.box_class   = this.get_opt(o, "box_class", "hotspots-box");
	this.box_active  = this.get_opt(o, "box_active", "active");
	this.box_hidden  = this.get_opt(o, "box_hidden", "hidden");
	this.box_padding = this.get_opt(o, "box_padding", 20);

	// state 
	this.div = null;
	this.svg = null;
	this.boxes = {};
	this.curr = null;
}

Hotspots.prototype.get_opt = function(o, p, d)
{
	return o && o.hasOwnProperty(p) ? o[p] : d;
};

/*
 * Add the given CSS class to the given element. If the given class is falsy 
 * (for example `null` or an empty string), this function does nothing.
 */
Hotspots.prototype.add_class = function(e, c)
{
	e && c && e.classList.add(c);
};

/*
 * Remove the given CSS class to the given element. If the given class is falsy
 * (for example `null` or an empty string), this function does nothing.
 */
Hotspots.prototype.rem_class = function(e, c)
{
	e && c && e.classList.remove(c);
};

/*
 * Tries to find a tab navigation that matches the `attr` and `name` 
 * options given (or using the defaults), then find the tab buttons 
 * within it, then populates the `this.tabs` object accordingly.
 * If all required elements could be found, it will hide all but one 
 * tab (either the one specified in the URL anchor, or the first one).
 */
Hotspots.prototype.init = function()
{
	if (!this.div)
	{
		var sel = this.attr + ((this.name) ? ('="' + this.name + '"') : '');
		console.log(sel);
		this.div = this.find_imap('[' + sel + ']');
	}
	if (!this.div) { return; }

	this.svg = this.div.querySelector("svg");
	if (!this.svg) { return; }

	// Get the click areas
	var areas = this.find_areas(this.svg);

	// Loop over all areas we've found
	var num_areas = areas.length;
	for (var i = 0; i < num_areas; ++i)
	{
		// Get the area's 'href' attribute (required)
		var href = this.href(areas[i]);
		if (!href) { continue; }
	
		// Extract the anchor string from the `href` (remove the #)
		var frag = this.frag(href);
		if (!frag) { continue; }

		// Find the box element corresponding to this area
		var box = document.getElementById(frag);
		if (!box) { continue; }
		console.log("cp3");
	
		// Add the general box class to the box element
		this.add_class(box, this.box_class);
	
		// Bind our area mouse event handler to the area
		var handler = this.handler.bind(this);
		areas[i].addEventListener("click", handler, false);
		areas[i].addEventListener("mouseover", handler, false);
		areas[i].addEventListener("mouseout", handler, false);
		
	
		// Add a record of this box to our state 
		this.boxes[frag] = { "area": areas[i], "box": box, "event": handler };
	}

	// No relevant buttons identified, aborting
	if (!Object.keys(this.boxes).length) { return; }

	// Hide/deactive all tabs first
	this.hide_all();

	// Mark this set of tabs as successfully processed ('set')
	this.div.setAttribute(this.attr + "-set", "");
	this.add_class(this.div, "hotspots");
};

Hotspots.prototype.viewbox_size = function(ele)
{
	var vb = ele.getAttribute("viewBox").split(" ");
	return { "width": parseInt(vb[2]), "height": parseInt(vb[3]) };
};

/*
 * TODO - there might be a better way, maybe
 * see https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Determining_the_dimensions_of_elements
 *
 * also, (almost) all ways of getting an element's size trigger a page
 * reflow (expensive!), so it might be wise to actually buffer these; 
 * the only issue with this is that we would miss if a script made changes 
 * to these elements that would then lead to a resize of them.
 * maybe the best solution is to buffer the sizes of relevant elements AND 
 * attach an event listener that updates the buffered sizes whenever there 
 * is a resize event? look into this whenever you have a bit of time (lol)
 */
Hotspots.prototype.computed_size = function(ele)
{
	var rect = ele.getBoundingClientRect();
	return { "width": rect.width, "height": rect.height };
};

Hotspots.prototype.position = function(area, box)
{
	var map_size_curr = this.computed_size(this.svg);
	var map_size_full = this.viewbox_size(this.svg);

	var factor_x = map_size_curr.width / map_size_full.width;
	var factor_y = map_size_curr.height / map_size_full.height;

	var circle = area.querySelector("circle");
	var area_x_rel = parseInt(circle.getAttribute("cx")) * factor_x;
	var area_y_rel = parseInt(circle.getAttribute("cy")) * factor_y;
	var area_r_rel = parseInt(circle.getAttribute("r")) * factor_x;

	var box_size = this.computed_size(box);
	var padding_rel = this.box_padding * factor_x;

	var space_right = map_size_curr.width - area_x_rel;
	var space_left  = map_size_curr.width - space_right;

	if (space_left >= space_right)
	{
		// BOX ON LEFT SIDE
		var x = area_x_rel - (area_r_rel + padding_rel + box_size.width);
		var y = area_y_rel - (box_size.height * 0.5);
		box.classList.remove("right");
		box.classList.add("left");
		box.style.left = x + "px";
		box.style.top =  y + "px";
	}
	else
	{
		// BOX ON RIGHT SIDE
		var x = area_x_rel + area_r_rel + padding_rel;
		var y = area_y_rel - (box_size.height * 0.5);
		box.classList.remove("left");
		box.classList.add("right");
		box.style.left = x + "px";
		box.style.top =  y + "px";
	}
};

/*
 * Tries to find the DOM element that matches the given attribute `attr` 
 * and value `name`. If no name is given, goes through all elements with 
 * the given attribute and returns the first one that has not already 
 * been processed by another Tab instance. Returns null if no matching 
 * element was found or all found elements are already processed.
 */
Hotspots.prototype.find_imap = function(sel)
{
	// Find all elements that match our CSS selector
	var imaps = document.querySelectorAll(sel);

	// Iterate over all elements that match our query
	var len = imaps.length;
	for (var i = 0; i < len; ++i)
	{
		// We found a matching element that has not been processed yet 
		if (!imaps[i].hasAttribute("data-imagemap-set"))
		{
			return imaps[i];
		}		
	}

	// Nothing found (that hasn't been processed yet), return null
	return null;
};

Hotspots.prototype.find_areas = function(imap) 
{
	return imap.querySelectorAll(".area a");
};

Hotspots.prototype.href = function(el)
{
	return el.getAttribute("xlink:href");
};

Hotspots.prototype.handler = function(event)
{
	// If no event is supplied, we can't do our job!
	if (!event) { return; }

	// Prevent browser from actually scrolling to the anchor
	event.preventDefault();
	event.stopPropagation();

	// Get the area's href attribute, we can't continue without
	var href = this.href(event.target.parentNode);

	// If the area's href is set, let's show the according box 
	if (!href) { return; }	

	if (event.type == "mouseover") {
		this.show(this.frag(href));
	}
	if (event.type == "mouseout") {
		this.hide(this.frag(href));
	}
	return false;
};

/*
 * Show the hotspot box identified by the given fragment (id).
 */
Hotspots.prototype.show = function(frag)
{
	var b = this.boxes[frag];
	this.rem_class(b.box, this.box_hidden);
	this.add_class(b.box, this.box_active);
	this.add_class(b.area, this.area_active);
	this.position(b.area, b.box);
};

/*
 * Hide the hotspot box identified by the given fragment (id).
 */
Hotspots.prototype.hide = function(frag)
{
	var b = this.boxes[frag];
	this.rem_class(b.area, this.area_active);
	this.rem_class(b.box, this.box_active);
	this.add_class(b.box, this.box_hidden);
};

/*
 * Hides all hotspot boxes.
 */
Hotspots.prototype.hide_all = function()
{
	for (var frag in this.boxes)
	{
		if (this.boxes.hasOwnProperty(frag))
		{
			this.hide(frag);
		}
	}
};

/*
 * Extract the fragment from the current URL or the given string.
 * If the string doesn't contain a fragment, "" is returned.
 * Example: "http://example.com#chapter-1" will return "chapter-1".
 */
Hotspots.prototype.frag = function(str)
{
	var url = (str) ? str.split("#") : document.URL.split("#");
	return (url.length > 1) ? url[1] : "";
};

/*
 * TODO implement
 */
Hotspots.prototype.kill = function()
{
	console.log("not implemented");
};


