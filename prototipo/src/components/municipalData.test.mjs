import {test} from 'node:test';
import assert from 'node:assert/strict';
import {municipalMeasures} from './municipalData.ts';
const population=[{municipality:'5103403',name:'Cuiabá',year:2022,population:200,population_18:50,population_19:50,population_20_24:100}];
test('sum offers across networks, count population only once',()=>{
 const rows=['1','2'].map(network=>({municipality:'5103403',name:'Cuiabá',network,vacancies:10,matriculated:15}));
 const result=municipalMeasures(rows,population)[0];
 assert.equal(result.population,200);assert.equal(result.vacancies,20);assert.equal(result.per100,10);
 assert.equal(municipalMeasures(rows.slice(0,1),population)[0].per100,5);
});
test('population without offer retains missing ratio',()=>{
 const result=municipalMeasures([],population)[0];
 assert.equal(result.population,200);assert.equal(result.vacancies,null);assert.equal(result.per100,null);
});
test('real zero and zero denominator remain distinct',()=>{
 const row={municipality:'5103403',name:'Cuiabá',network:'1',vacancies:0,matriculated:0};
 assert.equal(municipalMeasures([row],population)[0].per100,0);
 assert.equal(municipalMeasures([row],[{...population[0],population:0}])[0].per100,null);
});
