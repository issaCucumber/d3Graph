/**
 * Main Application
 */

$( document ).ready(function() {
    var graph = new ActivityGraph({
    	width : Math.floor($(window).width() * 0.6),
    	height : 200,
    	marginTop : 50
    });
    
    //click events
    $("body").on("click", "button.update", function(e){
    	graph.drawActivityGraph($("input#selected_date").val());
    	e.preventDefault();
    });
    
    graph.loadData("https://bitbucket.org/FMSurveyTeam/d3-test/raw/master/data.csv", function(){
    	$("#datetimepicker").datetimepicker({
    		format: "YYYY-MM-DD",
            defaultDate: graph.default_date,
            enabledDates: graph.enabled_dates
        });
    	
    	graph.drawActivityGraph(graph.default_date);
    });
    
    
});