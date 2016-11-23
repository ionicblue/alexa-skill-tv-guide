const TvGuide = require('../src/TvGuide');

test('does stuff', () => {
  expect(new Date("2016-11-20T19:15:00+00:00")).toEqual(new Date(2016, 10, 20, 19, 15, 0));
});

test('Can call TVmaze', () => {

  return new Promise((resolve) => {
    const tellWithCard = jest.fn(() => resolve(tellWithCard));
    TvGuide.getFinalScheduleResponse("Watchdog", { tellWithCard: tellWithCard });
  }).then((mockFn) => {
    console.log("tellWithCard.mock.calls");
    console.log(mockFn.mock.calls);

    expect(mockFn).toHaveBeenCalledWith("Watchdog is on next at 8:00 pm on Wednesday November 23rd on BBC One", "TvGuide", "Watchdog is on next at 8:00 pm on Wednesday November 23rd on BBC One");
  })
});