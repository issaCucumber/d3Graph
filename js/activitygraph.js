/**
 * Activity Graph
 */

var HOURS_A_DAY			= 24;
var MINUTES_AN_HOUR 	= 60;
var SECONDS_A_MINUTE	= 60;
var MILLISECOND			= 1000;
var DATE_GAP_TOLERATE 	= SECONDS_A_MINUTE * MILLISECOND; //1 minute
var SECONDS_A_DAY		= HOURS_A_DAY * MINUTES_AN_HOUR * SECONDS_A_MINUTE * MILLISECOND;
var BAR_HEIGHT			= 50;
var SUB_BAR_HEIGHT		= 20;
var SUB_BAR_Y_OFFSET	= 15;
var LABEL_Y_OFFSET		= 50;
var ICON_X_OFFSET		= 10;
var ICON_WIDTH			= 50;
var MIN_WIDTH_FOR_DETAIL = 30;

var ZOOM_LEVEL_FOR_DETAIL = 3.5;
var MAX_ZOOM_LEVEL = 30;

var timeFormat = d3.time.format("%H:%m");
var dateFormat = d3.time.format("%Y-%m-%d");
var fullDateFormat = d3.time.format("%Y-%m-%d %H:%M:%S");

function ActivityGraph(opt){
	this.containerId = "#activity-graph";
	
	this.width 	= opt.width || 960;
	this.height = opt.height || 500;
	this.margin = {top: 0, right: 0, bottom: 0, left: 0};
	
	this.margin.top 	= opt.marginTop || 0;
	this.margin.right 	= opt.marginRight || 0;
	this.margin.bottom 	= opt.marginBottom || 0;
	this.margin.left 	= opt.marginLeft || 0;
	
	//legend color
	this.activity_colors = {
		"Home" 							: "#adebad",
		"Travel" 						: "#f6a4a2",
		"Work"							: "#a5def3",
		"Change Travel Mode/Transfer"	: "#e6e6e6",
		"Drop-off"						: "#e6e6e6",
		"Others"						: "#d1d1e0"
	};
	
	this.activity_subcolors = {
		"Home" 							: "#32cd32",
		"Travel" 						: "#e81a17",
		"Work"							: "#1fade0",
		"Change Travel Mode/Transfer"	: "#808080",
		"Drop-off"						: "#808080",
		"Others"						: "#676798"
	};
	
	this.mode_icons = {
		"Car"							: "car"			,
		"Home"							: "home"		,
		"Change Travel Mode/Transfer"	: "transit"		,
		"Walk"							: "walk"		,
		"Train"							: "train"		,
		"Bus"							: "bus"			,
		"Drop-off"  					: "dropoff"		,
		"Work"							: "work"		,
		"Others"						: "others"
	};
	
	this.data 			= {}; //the data parsed from .csv file
	this.default_date 	= ""; //user selected date
	this.selected_date  = "";
	this.enabled_dates	= [];
	
	//the general timeline of user activity in a selected date
	//graphics components
	this.main = {
		svg : null,
		plot: null,
	    x : null,
	    y : d3.scale.linear()
	    .range([this.height, 0]),
	    
	    xAxis : null,
	    yAxis : d3.svg.axis()
	    .scale(this.y)
	    .orient("left")
	    .ticks(5)
	    .tickSize(-1 * this.width),
	    
	    xAxisMinor 	: null,
	    xAxisValues : null,
	    
	    subxAxis		: null,
	    subxAxisValue 	: null,
	    
	    zoom		: null,
	    scale		: null,
	    zoomtouch	: null
	};
	
	this.dateTolerance = 24 * 60 * 60 * 1000;
	
};

ActivityGraph.prototype.analyzeDataByTime = function(rowdata){
	
	var start_time			= new Date(rowdata['Start Time'].slice(0,-4));
	var end_time			= new Date(rowdata['End Time'].slice(0,-4));
	var start_fulldate 		= rowdata['Start Time'].split(" ")[0];
	
	var row_data = {
		'Start Time'	: start_time,
	    'End Time'		: end_time,
	    'Activity'		: rowdata['Activity'] || 'Others',
	    'Travel Mode'	: rowdata['Travel Mode'] || 'Unknown'
	  }; //row data
	
	//check if the timestamp is start of date
	var start_of_day = new Date(start_time.getFullYear(), start_time.getMonth(), start_time.getDate(), 0, 0, 0);
	var end_of_day 	 = new Date(start_time.getFullYear(), start_time.getMonth(), start_time.getDate(), 23, 59, 59);
	
	//analyze start time
	if(this.data[start_fulldate] == undefined){
	  if(this.default_date == ""){
		  this.default_date = start_fulldate; //default time is the first date detected
	  }
	  
	  this.data[start_fulldate] = [];
	  this.enabled_dates.push(start_fulldate);
	  
	  if(start_time.getTime() - start_of_day.getTime() <= DATE_GAP_TOLERATE){
		  row_data['Start Time'] = start_of_day;
	  }else{
		  var start_of_date_date = {
			  'Start Time'		: start_of_day,
			  'End Time'		: start_time,
			  'Activity'		: 'Others',
			  'Travel Mode'		: 'Unknown'  
		  }
		  
		  this.data[start_fulldate].push(start_of_date_date);
	  }
	}
	
	//analyze end time
	if(end_time.getTime() - end_of_day.getTime() > 0){ //record spills to the following day
		row_data['End Time'] = end_of_day;
		
		//fill in the gap
		var i = new Date(end_of_day.getTime() + MILLISECOND).getTime() ;
		var end_of_day_start = new Date(end_time.getFullYear(), end_time.getMonth(), end_time.getDate(), 0, 0, 0).getTime();
		
		while(end_of_day_start - i >= 0){
			var next_day_start 	= new Date(i);
			var next_day_end 	= new Date(i + SECONDS_A_DAY);
			
			var next_day_start_date = dateFormat(next_day_start);			
			var next_day_data = {
				  'Start Time'		: next_day_start,
				  'End Time'		: next_day_end,
				  'Activity'		: rowdata['Activity'] || 'Others',
				  'Travel Mode'		: rowdata['Travel Mode'] || 'Unknown'  
			  }
			
			if(end_time.getTime() - i <= SECONDS_A_DAY){
				next_day_data["End Time"] = end_time;
			}
			
			if(this.data[next_day_start_date] == undefined){
				this.data[next_day_start_date] = [];
				this.enabled_dates.push(next_day_start_date);
				this.data[next_day_start_date].push(next_day_data);
			}
			i += SECONDS_A_DAY;
		}
	
	}
	  
	this.data[start_fulldate].push(row_data); //assume all data is ordered
	this.legend();
	
	return row_data;
}

ActivityGraph.prototype.loadData = function(url, callback){
	if(url == "") return;
	
	var that = this;
	
	
	d3.csv(url, function(d) {
		
		  if(d == null || d == undefined){
			  return;
		  }
	
		  return that.analyzeDataByTime(d);
		  
		}, function(error, data) {
		  // return;
		  if (error) throw error;
		  
		  if(typeof callback == "function"){
			  callback();
		  }
		 
		}
	);
};

ActivityGraph.prototype.update_data = function() {
	 var that = this;
	 this.main.svg.selectAll("rect.bar")
		.attr("x", function(d){
			return that.main.scale(d['Start Time']);
		}) 
		.attr("width", function(d) {
			return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
	    });
	 
	 this.main.svg.selectAll("rect.subbar")
		.attr("x", function(d){
			return that.main.scale(d['Start Time']);
		}) 
		.attr("width", function(d) {
			return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
	    });
	 
	 this.main.svg.selectAll("foreignobject.modeObject")
		.attr("x", function(d){
			
			var scaled_width = that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
			var scaled_x	 = that.main.scale(d['Start Time']);
			
			if(scaled_x >= 0){
				//in view
				return scaled_x;
			}
			
			var scaled_offset = scaled_width + scaled_x;
			
			if(scaled_offset >= that.width){
				return that.width / 2;
			}
			
			if(scaled_offset > ICON_WIDTH){
				return scaled_offset - ICON_WIDTH;
			}
			
			return scaled_x;
			
		}) 
		.attr("width", function(d) {
			return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
	    })
	    .style({"display" : function(d){
	    	var scaled_width = that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
			var scaled_x	 = that.main.scale(d['Start Time']);
			
			if(scaled_width < MIN_WIDTH_FOR_DETAIL){
				return "none";
			}
			
			return "block";
	    }});
	 
	 if(this.main.zoom.scale() >= ZOOM_LEVEL_FOR_DETAIL){
		 $("rect.subbar").show();
		 $("div.mode").show();
	 }else{
		 $("rect.subbar").hide();
		 $("div.mode").hide();
	 }
	    
	  
	 return true;
};

ActivityGraph.prototype.drawActivityGraph = function(selected_date){
	
	if(selected_date == "") return;
	
	this.selected_date = selected_date;
	
	var data_to_load = this.data[selected_date];
	var date_arr = selected_date.split("-");
	
	if(date_arr.length == 0) return;
	
	var year 	= date_arr[0];
	var month 	= date_arr[1] - 1;
	var date 	= date_arr[2];
	
	var select_date_start_obj 	= new Date(year, month, date, 0, 0, 0);
	var select_date_end_obj 	= new Date(year, month, date, 23, 59, 59);
	var next_day_start_obj		= new Date(select_date_end_obj.getTime() + MILLISECOND);
	
	var that = this;
	
	$(this.containerId + " .graph-container").remove(); //clear
	
	$("<div></div>")
		.addClass("graph-container")
		.prependTo($(this.containerId));
	
	this.main.scale = d3.time.scale()
					    .domain([select_date_start_obj, next_day_start_obj])
					    .range([1, this.width]);
	
	this.main.svg = d3.select(this.containerId + " .graph-container").append("svg")
					    .attr("width", this.width + this.margin.left + this.margin.right + 1)
					    .attr("height", this.height + this.margin.top + this.margin.bottom)
					    .append("g")
					    .attr("transform", "translate(" + (this.margin.left) + "," + this.margin.top + ")");
	
	
	this.main.xAxis = d3.svg.axis()
					    .scale(this.main.scale)
					    .orient("bottom")
					    .tickSize(-10,10);
	
	this.main.xAxisValues = d3.svg.axis()
							    .scale(this.main.scale)
							    .orient("bottom")
							    .tickFormat(d3.time.format('%H:%M'))
							    .tickSize(0, 0);

	this.main.zoom = d3.behavior.zoom()
						    .scaleExtent([1, MAX_ZOOM_LEVEL])
						    .on("zoom", function(){
						    	that.main.svg.select("g").call(that.main.xAxis);
						    	that.main.svg.select("g.values").call(that.main.xAxisValues);
						        that.update_data();
						    }).x(this.main.scale);
	
	this.main.zoomtouch = this.main.svg.append("rect")
								.attr("class", "navigate")
							    .attr("x", 0)
							    .attr("y", 0)
							    .attr("width", this.width)
							    .attr("height", this.height)
							    .attr("opacity", 0)
							    .call(this.main.zoom);
	
	//draw a rectangle for each activity
	this.main.svg.selectAll("rect.bar").data(data_to_load)
	   .enter().append("rect")
	    .attr("class", "bar")
	    .style("fill", function(d) {
	      return that.activity_colors[d['Activity']];
	    })
	    .attr("x", function(d) {
	      // console.log(d['Start Time']);
	      return that.main.scale(d['Start Time']);
	    })
	    .attr("width", function(d) {
	      return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
	    })
	    .attr("y", function(d) { return 0; })
	    .attr("height", function(d) { return BAR_HEIGHT; })
	    .append("title")
	    .text(function(d) {
	      var mode = d['Activity'] || 'Unknown';
	      return mode + " (" + timeFormat(d['Start Time']) + ' to ' + timeFormat(d['End Time']) + ")";
	    });
	
	//draw a subbar
	this.main.svg.selectAll("rect.subbar").data(data_to_load)
	   .enter().append("rect")
	    .attr("class", "subbar")
	    .style("fill", function(d) {
	      return that.activity_subcolors[d['Activity']];
	    })
	    .attr("x", function(d) {
	      // console.log(d['Start Time']);
	      return that.main.scale(d['Start Time']);
	    })
	    .attr("width", function(d) {
	      return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
	    })
	    .attr("y", function(d) { return SUB_BAR_Y_OFFSET; })
	    .attr("height", function(d) { return SUB_BAR_HEIGHT; })
	    .append("title")
	    .text(function(d) {
	      var mode = d['Activity'] || 'Unknown';
	      return mode + " (" + timeFormat(d['Start Time']) + ' to ' + timeFormat(d['End Time']) + ")";
	    });
	
	//draw a detail body for each
	this.main.svg.selectAll("foreignObject").data(data_to_load)
		.enter().append("foreignObject")
			.attr("class", "modeObject")
			.attr("x", function(d) {
		      // console.log(d['Start Time']);
		      return that.main.scale(d['Start Time']);
		    })
		    .attr("width", function(d) {
		      return that.main.scale(d['End Time']) - that.main.scale(d['Start Time']);
		    })
		    .attr("y", function(d) { return SUB_BAR_Y_OFFSET; })
		    .attr("height", function(d) { return SUB_BAR_HEIGHT; })
		    .attr("transform", "translate("+ICON_X_OFFSET+",0)")
		    .append("xhtml:body")
		    .html(function(d){
		    	if(that.mode_icons[d["Travel Mode"]] == undefined && that.mode_icons[d["Activity"]] == undefined){
					return "";
				}
				
				var mode_index = (that.mode_icons[d["Travel Mode"]] == undefined) ? that.mode_icons[d["Activity"]] : that.mode_icons[d["Travel Mode"]];
				
				return "<div class='mode "+mode_index+"'></div>";
		    });
	
	this.main.xAxisValues.tickValues(data_to_load.map(
			  function(d) {
				  return d['Start Time']}
			  )
		);
	
	this.main.svg.append("g")
	    .attr("class", "x axis")
	    .call(this.main.xAxis);
	
	this.main.svg.append("g")
	    .attr("class", "x axis values")
	    .attr("transform", "translate(0," + LABEL_Y_OFFSET + ")")
	    .call(this.main.xAxisValues);
	
}

ActivityGraph.prototype.legend = function(){
	$(this.containerId + " .legend").remove();
	var $legend = $("<div></div>")
						.addClass("legend")
						.appendTo($(this.containerId));
	
	var $legend_list = $("<ul></ul>")
							.addClass("legend-list")
							.appendTo($legend);
	
	var that = this;
	$.each(this.activity_colors, function(activity, color){
		$("<li></li>")
			.css("background", color)
			.text(activity)
			.appendTo($legend_list);
	});
}
