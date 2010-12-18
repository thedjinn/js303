Feature: Front page
    In order to make music
    As a musician
    I want to operate the js303 site

    Scenario: Saving a valid song
        When I submit the following song to the storage url:
            | field | value |
            | data  | "foo" |
        Then I should get a six digit hash

    Scenario: Saving a song with different fields
        When I submit the following song to the storage url:
            | field | value |
            | blah  | blah  |
        Then I should get an "error:formdata" error

    Scenario: Saving a song with bad JSON
        When I submit the following song to the storage url:
            | field | value |
            | data  | !@#$% |
        Then I should get an "error:bad json" error

    Scenario: Going to store with GET
        When I go to the storage url
        Then I should get a 404 error

    Scenario: Loading a valid song
        Given there is a song with hash abcdef
        When I go to the page for the song with hash abcdef
        Then I should see javascript for a song

    Scenario: Loading an invalid song
        Given there is no song with hash abcdef
        When I go to the page for the song with hash abcdef
        Then I should get a 404 error

    Scenario: Loading default song
        When I go to the front page
        Then I should not see javascript for a song

    Scenario: Getting stylesheet
        When I go to the stylesheet
        Then I should not get a 404 error
